/**
 * src/core/media/mediaProbe.ts
 *
 * Lightweight, zero-dependency client-side container probe.
 * Reads the headers of MKV/WebM (EBML) and MP4/MOV (ISO-BMFF)
 * in < 5ms to extract actual streams, real track titles (e.g. OBS "TUDO", "MIC", "PC"),
 * codecs, and confirms whether subtitles exist.
 */

export interface ProbedStream {
  streamIndex: number;
  trackIndex: number;
  type: 'video' | 'audio' | 'subtitle';
  title?: string;
  codec?: string;
  language?: string;
}

export interface MediaProbeResult {
  format: 'mkv' | 'mp4' | 'webm' | 'unknown';
  videoStreams: ProbedStream[];
  audioStreams: ProbedStream[];
  subtitleStreams: ProbedStream[];
}

function probeMatroska(bytes: Uint8Array): MediaProbeResult {
  const videoStreams: ProbedStream[] = [];
  const audioStreams: ProbedStream[] = [];
  const subtitleStreams: ProbedStream[] = [];
  const decoder = new TextDecoder('utf-8');

  // Search only within header (first 64 KB)
  const limit = Math.min(bytes.length, 64 * 1024);

  let audioCounter = 0;
  let subCounter = 0;
  let videoCounter = 0;

  for (let i = 0; i < limit - 10; i++) {
    // TrackEntry is 0xAE, avoiding bytes belonging to 0x16 0x54 0xAE 0x6B (Tracks)
    if (bytes[i] === 0xae) {
      if (i >= 2 && bytes[i - 2] === 0x16 && bytes[i - 1] === 0x54) continue;
      if (bytes[i + 1] === 0x6b) continue;

      const entryEnd = Math.min(limit, i + 350);
      let trackType = 0;
      let trackName = '';
      let codecId = '';
      let language = '';

      for (let j = i + 1; j < entryEnd; j++) {
        // Stop if we hit next TrackEntry
        if (bytes[j] === 0xae && j > i + 10 && (bytes[j + 1] === 0x01 || (bytes[j + 1] & 0x80))) {
          break;
        }

        // TrackType: 0x83 0x81 [1|2|17]
        if (bytes[j] === 0x83 && bytes[j + 1] === 0x81) {
          trackType = bytes[j + 2];
        }

        // TrackName: 0x53 0x6e [len] [utf-8 string]
        if (bytes[j] === 0x53 && bytes[j + 1] === 0x6e) {
          const nLen = bytes[j + 2] & 0x7f;
          if (nLen > 0 && nLen < 50 && j + 3 + nLen <= entryEnd) {
            trackName = decoder.decode(bytes.slice(j + 3, j + 3 + nLen));
          }
        }

        // CodecID: 0x86 [len] [ascii string]
        if (bytes[j] === 0x86) {
          const cLen = bytes[j + 1] & 0x7f;
          if (cLen > 0 && cLen < 30 && j + 2 + cLen <= entryEnd) {
            codecId = decoder.decode(bytes.slice(j + 2, j + 2 + cLen)).replace(/^[A-Z]_/, '').toLowerCase();
          }
        }

        // Language: 0x22 0xb5 0x9c [len] [ascii string]
        if (bytes[j] === 0x22 && bytes[j + 1] === 0xb5 && bytes[j + 2] === 0x9c) {
          const lLen = bytes[j + 3] & 0x7f;
          if (lLen > 0 && lLen < 10 && j + 4 + lLen <= entryEnd) {
            language = decoder.decode(bytes.slice(j + 4, j + 4 + lLen));
          }
        }
      }

      if (trackType === 1) {
        videoStreams.push({
          streamIndex: 0,
          trackIndex: videoCounter++,
          type: 'video',
          title: trackName || 'Vídeo Principal',
          codec: codecId,
          language,
        });
      } else if (trackType === 2) {
        audioStreams.push({
          streamIndex: audioCounter + 1,
          trackIndex: audioCounter++,
          type: 'audio',
          title: trackName || (audioCounter === 1 ? 'Principal / Mix' : `Faixa ${audioCounter}`),
          codec: codecId,
          language,
        });
      } else if (trackType === 17) {
        subtitleStreams.push({
          streamIndex: subCounter + 1,
          trackIndex: subCounter++,
          type: 'subtitle',
          title: trackName || `Legenda ${subCounter}`,
          codec: codecId,
          language,
        });
      }
    }
  }

  return { format: 'mkv', videoStreams, audioStreams, subtitleStreams };
}

function probeMp4(bytes: Uint8Array): MediaProbeResult {
  const videoStreams: ProbedStream[] = [];
  const audioStreams: ProbedStream[] = [];
  const subtitleStreams: ProbedStream[] = [];

  const decoder = new TextDecoder('ascii');
  let pos = 0;
  const limit = Math.min(bytes.length, 1024 * 1024);

  let audioCounter = 0;
  let subCounter = 0;
  let videoCounter = 0;

  while (pos + 8 < limit) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + pos, 8);
    const size = view.getUint32(0);
    const type = decoder.decode(bytes.slice(pos + 4, pos + 8));

    if (size < 8) break;

    if (type === 'moov') {
      let trakPos = pos + 8;
      const moovEnd = pos + size;

      while (trakPos + 8 < moovEnd && trakPos + 8 < limit) {
        const tView = new DataView(bytes.buffer, bytes.byteOffset + trakPos, 8);
        const tSize = tView.getUint32(0);
        const tType = decoder.decode(bytes.slice(trakPos + 4, trakPos + 8));

        if (tSize < 8) break;

        if (tType === 'trak') {
          const trakEnd = trakPos + tSize;
          let subBox = trakPos + 8;
          let hdlrType = '';

          while (subBox + 8 < trakEnd && subBox + 8 < limit) {
            const sView = new DataView(bytes.buffer, bytes.byteOffset + subBox, 8);
            const sSize = sView.getUint32(0);
            const sType = decoder.decode(bytes.slice(subBox + 4, subBox + 8));

            if (sSize < 8) break;

            if (sType === 'mdia') {
              let mBox = subBox + 8;
              const mdiaEnd = subBox + sSize;
              while (mBox + 16 < mdiaEnd && mBox + 16 < limit) {
                const mView = new DataView(bytes.buffer, bytes.byteOffset + mBox, 8);
                const mSize = mView.getUint32(0);
                const mType = decoder.decode(bytes.slice(mBox + 4, mBox + 8));
                if (mSize < 8) break;

                if (mType === 'hdlr' && mBox + 16 < limit) {
                  hdlrType = decoder.decode(bytes.slice(mBox + 16, mBox + 20));
                  break;
                }
                mBox += mSize;
              }
            }

            subBox += sSize;
          }

          if (hdlrType === 'vide') {
            videoStreams.push({
              streamIndex: 0,
              trackIndex: videoCounter++,
              type: 'video',
              title: 'Vídeo Principal',
            });
          } else if (hdlrType === 'soun') {
            audioStreams.push({
              streamIndex: audioCounter + 1,
              trackIndex: audioCounter++,
              type: 'audio',
              title: audioCounter === 1 ? 'Principal / Mix' : `Faixa ${audioCounter}`,
            });
          } else if (hdlrType === 'subt' || hdlrType === 'sbtl' || hdlrType === 'text') {
            subtitleStreams.push({
              streamIndex: subCounter + 1,
              trackIndex: subCounter++,
              type: 'subtitle',
              title: `Legenda ${subCounter}`,
            });
          }
        }

        trakPos += tSize;
      }
      break;
    }

    pos += size;
  }

  return { format: 'mp4', videoStreams, audioStreams, subtitleStreams };
}

/**
 * Rapidly probes binary media data to extract track types, real names, and codecs.
 */
export function probeMediaData(bytes: Uint8Array): MediaProbeResult {
  if (!bytes || bytes.length < 16) {
    return { format: 'unknown', videoStreams: [], audioStreams: [], subtitleStreams: [] };
  }

  // Check Matroska / WebM EBML header: 0x1A 0x45 0xDF 0xA3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return probeMatroska(bytes);
  }

  // Check MP4 / MOV ftyp signature: bytes 4-8 === 'ftyp' or 'moov'
  const tag = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (tag === 'ftyp' || tag === 'moov' || tag === 'wide') {
    return probeMp4(bytes);
  }

  return { format: 'unknown', videoStreams: [], audioStreams: [], subtitleStreams: [] };
}
