declare module 'mp4box' {
  export interface MP4File {
    onReady?: (info: MP4Info) => void;
    onError?: (module: string | any, msg?: string | any) => void;
    onSamples?: (id: number, user: unknown, samples: MP4Sample[]) => void;
    appendBuffer(data: ArrayBuffer, last?: boolean): number;
    flush(): void;
    setExtractionOptions(id: number, user?: unknown, options?: { nbSamples?: number }): void;
    start(): void;
    stop(): void;
  }

  export interface MP4Track {
    id: number;
    name?: string;
    codec: string;
    type: 'video' | 'audio';
    track_width?: number;
    track_height?: number;
    nb_samples: number;
    duration: number;
    timescale: number;
  }

  export interface MP4Info {
    duration: number;
    timescale: number;
    tracks: MP4Track[];
    videoTracks: MP4Track[];
    audioTracks: MP4Track[];
  }

  export interface MP4Sample {
    number: number;
    track_id: number;
    description: unknown;
    is_sync: boolean;
    dts: number;
    cts: number;
    duration: number;
    timescale: number;
    size: number;
    data: Uint8Array;
  }

  export function createFile(): MP4File;
}
