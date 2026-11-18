import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Cpu,
  Zap,
  Mic,
  Square,
  Download,
  Trash2,
  Play,
  HardDrive,
  FileAudio,
  Image as ImageIcon,
  FileText,
  Volume2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button, Card, Typography, Badge } from '@/ui/components/core';
import { UploadDropzone } from '@/ui/components/UploadDropzone';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/formats';
import { getModuleById } from '@/modules/registry';
import {
  AI_MODELS_CATALOG,
  detectAIBackend,
  listCachedModels,
  deleteCachedModel,
  clearAllModelCaches,
  getTotalCachedBytes,
  type AIHardwareCapabilities,
  type AIModelCatalogEntry,
  type AITaskCategory,
  type CachedModelRecord,
} from '@/core/ai/AIModelManager';
import { encodePcmToWav } from '@/modules/ai/aiUtils';
import type { DictionReport } from '@/modules/ai/ai-diction-coach';

const CATEGORY_TABS: Array<{ id: 'all' | AITaskCategory; label: string }> = [
  { id: 'all', label: 'Todos (8)' },
  { id: 'image', label: 'Imagem' },
  { id: 'speech', label: 'Fala & Dicção' },
  { id: 'audio', label: 'Áudio' },
  { id: 'document', label: 'Documento / OCR' },
];

export function LocalAIHub() {
  const [hardware, setHardware] = useState<AIHardwareCapabilities | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | AITaskCategory>('all');
  const [selectedId, setSelectedId] = useState<string>(AI_MODELS_CATALOG[0].id);
  const [cachedRecords, setCachedRecords] = useState<CachedModelRecord[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [targetExt, setTargetExt] = useState<string>(AI_MODELS_CATALOG[0].outputExtensions[0]);
  const [promptText, setPromptText] = useState<string>(
    'Olá! Esta narração foi sintetizada localmente no navegador sem enviar dados para servidores.'
  );
  const [referenceText, setReferenceText] = useState<string>('');
  const [hintText, setHintText] = useState<string>('');
  const [voice, setVoice] = useState<'pt-br' | 'en-us' | 'neutral'>('pt-br');
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0);
  const [chromaTolerance, setChromaTolerance] = useState<number>(42);
  const [scaleFactor, setScaleFactor] = useState<2 | 4>(2);
  const [bokehBlur, setBokehBlur] = useState<boolean>(false);

  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);

  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputName, setOutputName] = useState<string>('');
  const [outputMime, setOutputMime] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [dictionReport, setDictionReport] = useState<DictionReport | null>(null);

  const selectedModel: AIModelCatalogEntry =
    AI_MODELS_CATALOG.find((m) => m.id === selectedId) ?? AI_MODELS_CATALOG[0];

  useEffect(() => {
    detectAIBackend().then(setHardware);
    setCachedRecords(listCachedModels());
  }, []);

  useEffect(() => {
    setTargetExt(selectedModel.outputExtensions[0]);
    setStatus('idle');
    setErrorMsg('');
    setProgress(0);
    setTextPreview(null);
    setDictionReport(null);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl(null);
  }, [selectedId]);

  const filteredCatalog = useMemo(
    () =>
      categoryFilter === 'all'
        ? AI_MODELS_CATALOG
        : AI_MODELS_CATALOG.filter((m) => m.category === categoryFilter),
    [categoryFilter]
  );

  function refreshCacheState() {
    setCachedRecords(listCachedModels());
  }

  async function toggleMicRecording() {
    if (isRecording) {
      recorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      recordChunksRef.current = chunks;
      const mr = new MediaRecorder(stream);
      recorderRef.current = mr;

      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const rawBlob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        try {
          const ctx = new AudioContext();
          const decoded = await ctx.decodeAudioData(await rawBlob.arrayBuffer());
          const chs: Float32Array[] = [];
          for (let c = 0; c < decoded.numberOfChannels; c++) {
            chs.push(new Float32Array(decoded.getChannelData(c)));
          }
          const wavBytes = encodePcmToWav(chs, decoded.sampleRate);
          await ctx.close();
          const wavFile = new File([wavBytes.buffer as unknown as BlobPart], 'gravacao_microfone.wav', {
            type: 'audio/wav',
          });
          setFile(wavFile);
        } catch {
          const fallbackFile = new File([rawBlob], 'gravacao_microfone.webm', { type: rawBlob.type });
          setFile(fallbackFile);
        }
      };

      mr.start();
      setIsRecording(true);
    } catch (err) {
      setErrorMsg(`Falha ao acessar microfone: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function runAITool() {
    const isTts = selectedModel.id === 'ai-tts-kokoro';
    if (!isTts && !file) {
      setErrorMsg('Selecione um arquivo ou grave um áudio antes de executar.');
      setStatus('error');
      return;
    }

    const mod = getModuleById(selectedModel.id);
    if (!mod) {
      setErrorMsg(`Módulo de IA não encontrado: ${selectedModel.id}`);
      setStatus('error');
      return;
    }

    setStatus('running');
    setProgress(5);
    setProgressMsg(`Executando ${selectedModel.shortName}...`);
    setLogs([]);
    setErrorMsg('');
    setTextPreview(null);
    setDictionReport(null);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl(null);

    try {
      const options: Record<string, unknown> = {
        promptText,
        referenceText,
        hintText,
        voice,
        speed: ttsSpeed,
        chromaTolerance,
        scaleFactor,
        bokehBlur,
        useTransformersPipeline: true,
      };

      const res = await mod.execute(
        {
          file: file ?? undefined,
          originalName: file ? file.name : 'narracao_tts.txt',
          targetFormat: targetExt,
          options,
          modifiers: options,
        },
        {
          workspacePath: `/ai/${selectedModel.id}`,
          onProgress: (p, msg) => {
            setProgress(p);
            if (msg) setProgressMsg(msg);
          },
          onLog: (msg) => setLogs((prev) => [...prev.slice(-80), msg]),
        }
      );

      const blob =
        res.outputBlob instanceof Blob
          ? res.outputBlob
          : new Blob([(res.outputData as Uint8Array).buffer as unknown as BlobPart], {
              type: (res.mimeType as string) || 'application/octet-stream',
            });

      const outName = (res.outputFileName as string) || `output${targetExt}`;
      const mime = (res.mimeType as string) || blob.type;
      setOutputUrl(URL.createObjectURL(blob));
      setOutputName(outName);
      setOutputMime(mime);
      setOutputSize(blob.size);

      if (mime.startsWith('text/') || mime.includes('json') || /\.(srt|vtt|md|txt|json)$/i.test(outName)) {
        const txt = await blob.text();
        setTextPreview(txt);
        if (selectedModel.id === 'ai-diction-coach' && outName.endsWith('.json')) {
          try {
            setDictionReport(JSON.parse(txt) as DictionReport);
          } catch {
            // ignore JSON parse issues
          }
        }
      }

      refreshCacheState();
      setStatus('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  const totalCachedBytes = getTotalCachedBytes();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <Typography variant="h1" as="h1">
              IAs Locais (Offline & Zero Upload)
            </Typography>
          </div>
          <Typography variant="caption" color="muted" className="mt-1 block">
            Modelos executados diretamente no seu dispositivo via WebGPU e WebAssembly SIMD.
          </Typography>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hardware && (
            <Badge variant={hardware.webgpuAvailable ? 'primary' : 'secondary'}>
              {hardware.webgpuAvailable ? <Zap className="size-3" /> : <Cpu className="size-3" />}
              <span>
                {hardware.webgpuAvailable
                  ? `WebGPU (${hardware.adapterDescription || 'Ativo'})`
                  : `WASM${hardware.simdSupported ? ' + SIMD' : ''}`}
              </span>
            </Badge>
          )}
          <Badge variant="outline">
            <HardDrive className="size-3" />
            <span>Cache: {cachedRecords.length} modelo(s) · {formatBytes(totalCachedBytes)}</span>
          </Badge>
          {cachedRecords.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await clearAllModelCaches();
                refreshCacheState();
              }}
              leftIcon={<Trash2 className="size-3.5" />}
            >
              Limpar cache
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_TABS.map((tab) => (
          <Badge
            key={tab.id}
            interactive
            selected={categoryFilter === tab.id}
            onClick={() => setCategoryFilter(tab.id)}
          >
            {tab.label}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 grid gap-2">
          {filteredCatalog.map((model) => {
            const isSelected = model.id === selectedModel.id;
            const isCached = cachedRecords.some((r) => r.modelId === model.id);
            return (
              <Card
                key={model.id}
                variant={isSelected ? 'alert-success' : 'interactive'}
                className={cn(
                  'cursor-pointer p-3 transition-all',
                  isSelected && 'border-primary/60'
                )}
                onClick={() => setSelectedId(model.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Typography variant="body" className="font-medium text-foreground">
                        {model.shortName}
                      </Typography>
                      <Badge variant={model.recommendedBackend === 'webgpu' ? 'primary' : 'default'} size="sm">
                        {model.recommendedBackend.toUpperCase()}
                      </Badge>
                      {isCached && (
                        <Badge variant="secondary" size="sm">
                          <CheckCircle2 className="size-3" />
                          Em cache
                        </Badge>
                      )}
                    </div>
                    <Typography variant="caption" color="muted" className="mt-1 block">
                      {model.description}
                    </Typography>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-mono text-[10px] text-muted-foreground">~{model.estimatedSizeMB} MB</span>
                    {isCached && (
                      <button
                        type="button"
                        title="Remover modelo do cache"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await deleteCachedModel(model.id);
                          refreshCacheState();
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card variant="raised" className="lg:col-span-7 p-4 space-y-4">
          <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
            <div>
              <Typography variant="h2" as="h2">
                {selectedModel.name}
              </Typography>
              <Typography variant="code" color="muted" className="mt-0.5 block">
                Modelo: {selectedModel.hfModelId} · Saídas: {selectedModel.outputExtensions.join(', ')}
              </Typography>
            </div>
            <div className="flex gap-1">
              {selectedModel.outputExtensions.map((ext) => (
                <Badge
                  key={ext}
                  interactive
                  selected={targetExt === ext}
                  onClick={() => setTargetExt(ext)}
                >
                  {ext.toUpperCase()}
                </Badge>
              ))}
            </div>
          </div>

          {selectedModel.id === 'ai-tts-kokoro' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">
                  Texto ou roteiro para locução
                </label>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-border bg-surface p-2.5 text-[13px] text-foreground focus:outline-none focus:border-primary"
                  placeholder="Digite o texto para sintetizar voz localmente..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">Idioma / Voz</label>
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value as 'pt-br' | 'en-us' | 'neutral')}
                    className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-foreground"
                  >
                    <option value="pt-br">Português (BR)</option>
                    <option value="en-us">Inglês (US)</option>
                    <option value="neutral">Voz Neutra</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">
                    Velocidade: {ttsSpeed.toFixed(2)}x
                  </label>
                  <input
                    type="range"
                    min="0.75"
                    max="1.5"
                    step="0.05"
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {file ? (
                <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
                  <div className="min-w-0">
                    <Typography variant="body" className="truncate font-medium">
                      {file.name}
                    </Typography>
                    <Typography variant="code" color="muted">
                      {formatBytes(file.size)}
                    </Typography>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setFile(null)}>
                    Trocar arquivo
                  </Button>
                </div>
              ) : (
                <UploadDropzone
                  onFile={(f) => setFile(f)}
                  accept={selectedModel.inputExtensions.join(',')}
                  hint={`Aceita: ${selectedModel.inputExtensions.join(', ')}`}
                />
              )}

              {(selectedModel.id === 'ai-diction-coach' || selectedModel.id === 'ai-whisper-stt') && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={isRecording ? 'destructive' : 'secondary'}
                    leftIcon={isRecording ? <Square className="size-3.5" /> : <Mic className="size-3.5" />}
                    onClick={toggleMicRecording}
                  >
                    {isRecording ? 'Parar gravação do microfone' : 'Gravar do microfone'}
                  </Button>
                </div>
              )}

              {selectedModel.id === 'ai-diction-coach' && (
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">
                    Roteiro de referência (opcional para medir aderência)
                  </label>
                  <textarea
                    value={referenceText}
                    onChange={(e) => setReferenceText(e.target.value)}
                    rows={2}
                    placeholder="Cole o texto esperado da leitura..."
                    className="w-full rounded-md border border-border bg-surface p-2 text-[12px] text-foreground"
                  />
                </div>
              )}

              {selectedModel.id === 'ai-whisper-stt' && (
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">
                    Roteiro / vocabulário guia (opcional para alinhamento)
                  </label>
                  <input
                    type="text"
                    value={hintText}
                    onChange={(e) => setHintText(e.target.value)}
                    placeholder="Ex: Termos técnicos ou falas esperadas..."
                    className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-foreground"
                  />
                </div>
              )}

              {selectedModel.id === 'ai-bg-remove' && (
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">
                    Tolerância de fundo: {chromaTolerance}
                  </label>
                  <input
                    type="range"
                    min="12"
                    max="80"
                    value={chromaTolerance}
                    onChange={(e) => setChromaTolerance(parseInt(e.target.value, 10))}
                    className="w-full accent-primary"
                  />
                </div>
              )}

              {selectedModel.id === 'ai-upscaler' && (
                <div className="flex items-center gap-2">
                  <Typography variant="caption" color="muted">Fator de ampliação:</Typography>
                  {([2, 4] as const).map((factor) => (
                    <Badge
                      key={factor}
                      interactive
                      selected={scaleFactor === factor}
                      onClick={() => setScaleFactor(factor)}
                    >
                      {factor}x
                    </Badge>
                  ))}
                </div>
              )}

              {selectedModel.id === 'ai-depth-map' && (
                <div className="flex items-center gap-2">
                  <Badge interactive selected={!bokehBlur} onClick={() => setBokehBlur(false)}>
                    Mapa Z-Depth (Cinza)
                  </Badge>
                  <Badge interactive selected={bokehBlur} onClick={() => setBokehBlur(true)}>
                    Aplicar Desfoque Bokeh
                  </Badge>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="primary"
              onClick={runAITool}
              disabled={status === 'running'}
              leftIcon={<Play className="size-3.5" />}
            >
              {status === 'running' ? `Processando (${progress}%)` : `Executar ${selectedModel.shortName}`}
            </Button>
          </div>

          {status === 'running' && (
            <div className="space-y-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <Typography variant="caption" color="muted">
                {progressMsg}
              </Typography>
            </div>
          )}

          {status === 'error' && (
            <Card variant="alert-destructive" className="p-3 flex items-start gap-2">
              <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
              <Typography variant="caption" color="destructive">
                {errorMsg}
              </Typography>
            </Card>
          )}

          {status === 'done' && outputUrl && (
            <div className="space-y-3 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {outputMime.startsWith('image/') ? (
                    <ImageIcon className="size-4 text-primary" />
                  ) : outputMime.startsWith('audio/') ? (
                    <Volume2 className="size-4 text-primary" />
                  ) : (
                    <FileText className="size-4 text-primary" />
                  )}
                  <Typography variant="body" className="truncate font-medium">
                    {outputName} ({formatBytes(outputSize)})
                  </Typography>
                </div>
                <a
                  href={outputUrl}
                  download={outputName}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90"
                >
                  <Download className="size-3.5" />
                  Baixar
                </a>
              </div>

              {outputMime.startsWith('image/') && (
                <div className="rounded-md border border-border bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)] bg-[length:16px_16px] p-2 flex justify-center">
                  <img src={outputUrl} alt={outputName} className="max-h-64 object-contain rounded" />
                </div>
              )}

              {outputMime.startsWith('audio/') && (
                <div className="flex items-center gap-2">
                  <FileAudio className="size-4 text-muted-foreground" />
                  <audio controls src={outputUrl} className="w-full h-9" />
                </div>
              )}

              {dictionReport && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Card variant="default" className="p-2.5 text-center">
                    <Typography variant="caption" color="muted">Clareza</Typography>
                    <Typography variant="h2">{dictionReport.clarityScore}/100</Typography>
                  </Card>
                  <Card variant="default" className="p-2.5 text-center">
                    <Typography variant="caption" color="muted">Ritmo</Typography>
                    <Typography variant="h2">{dictionReport.wpm} PPM</Typography>
                  </Card>
                  <Card variant="default" className="p-2.5 text-center">
                    <Typography variant="caption" color="muted">Pausas</Typography>
                    <Typography variant="h2">{dictionReport.pauseCount}</Typography>
                  </Card>
                  <Card variant="default" className="p-2.5 text-center">
                    <Typography variant="caption" color="muted">SNR Vocal</Typography>
                    <Typography variant="h2">{dictionReport.snrDb} dB</Typography>
                  </Card>
                </div>
              )}

              {textPreview !== null && (
                <pre className="rounded-md border border-border bg-black/70 p-3 font-mono text-[11px] text-zinc-200 max-h-56 overflow-y-auto whitespace-pre-wrap">
                  {textPreview}
                </pre>
              )}
            </div>
          )}

          {logs.length > 0 && (
            <div className="rounded-md border border-border bg-surface p-2 font-mono text-[10px] text-muted-foreground max-h-24 overflow-y-auto">
              {logs.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
