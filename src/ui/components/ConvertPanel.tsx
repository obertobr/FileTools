import { useState, useEffect } from 'react';
import { AlertCircle, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { UploadDropzone } from './UploadDropzone';
import { FilePreview } from './FilePreview';
import { SearchInput } from './SearchInput';
import { CategoryFilter } from './CategoryFilter';
import { FormatSelector } from './FormatSelector';
import { EngineSelector } from './EngineSelector';
import { ConversionProgress } from './ConversionProgress';
import { DownloadResult } from './DownloadResult';
import { Button, Card, Typography } from '@/ui/components/core';
import { FORMATS, describeFile, type Format } from '@/lib/formats';
import { resolvePossibleConversions, resolveAvailableEngines, type EngineOption } from '@/modules/registry';
import { WorkerManager } from '@/core/engine/WorkerManager';

type Status = 'idle' | 'converting' | 'done' | 'error';

export function ConvertPanel({
  fixedTarget,
  accept,
  hint,
}: {
  fixedTarget?: string;
  accept?: string;
  hint?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<string | null>(fixedTarget ?? null);
  const [availableEngines, setAvailableEngines] = useState<EngineOption[]>([]);
  const [selectedEngineId, setSelectedEngineId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState<string | undefined>();
  const [logs, setLogs] = useState<string[]>([]);
  const [showErrorLogs, setShowErrorLogs] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [failedEngineName, setFailedEngineName] = useState<string>('');
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number>(0);

  const target = fixedTarget ?? selected;
  const sourceExt = file ? describeFile(file.name).ext : null;

  // Resolve possible conversions dynamically from the module registry
  const availableFormats: Format[] = (() => {
    if (sourceExt && file) {
      const possible = resolvePossibleConversions(sourceExt, file.type);
      const targetExts = new Set<string>();
      
      possible.forEach(p => {
        p.toExtensions.forEach(ext => {
          const normalizedExt = ext.replace('.', '').toUpperCase();
          targetExts.add(normalizedExt);
        });
      });

      return FORMATS
        .filter(f => targetExts.has(f.ext) && f.ext !== sourceExt)
        .filter((c) => {
          const matchesCategory = category === 'all' || c.category === category;
          const matchesQuery =
            c.ext.toLowerCase().includes(query.toLowerCase().trim()) ||
            c.label.toLowerCase().includes(query.toLowerCase().trim());
          return matchesCategory && matchesQuery;
        });
    }
    
    return FORMATS.filter(
      (f) =>
        f.ext !== sourceExt &&
        (category === 'all' || f.category === category) &&
        (f.ext.toLowerCase().includes(query.toLowerCase().trim()) ||
          f.label.toLowerCase().includes(query.toLowerCase().trim())),
    );
  })();

  // Asynchronously probe client hardware and resolve truly compatible engines
  useEffect(() => {
    let isCurrent = true;
    if (sourceExt && target) {
      resolveAvailableEngines(sourceExt, target, file?.type).then((engines) => {
        if (isCurrent) {
          setAvailableEngines(engines);
          if (engines.length > 0) {
            setSelectedEngineId((prev) => {
              const stillExists = engines.some((e) => e.moduleId === prev);
              return stillExists ? prev : engines[0].moduleId;
            });
          } else {
            setSelectedEngineId(null);
          }
        }
      });
    } else {
      setAvailableEngines([]);
      setSelectedEngineId(null);
    }
    return () => {
      isCurrent = false;
    };
  }, [sourceExt, target, file]);

  const activeEngine = availableEngines.find((e) => e.moduleId === selectedEngineId) ?? availableEngines[0];

  function reset() {
    setFile(null);
    setStatus('idle');
    setProgress(0);
    setProgressMessage(undefined);
    setLogs([]);
    setShowErrorLogs(false);
    setErrorMessage('');
    setFailedEngineName('');
    setSelectedEngineId(null);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl(null);
    setOutputSize(0);
    if (!fixedTarget) setSelected(null);
  }

  async function start(overrideEngineId?: string) {
    if (!file || !target) return;
    const engineToUse = overrideEngineId 
      ? (availableEngines.find(e => e.moduleId === overrideEngineId) ?? activeEngine)
      : activeEngine;

    if (!engineToUse) return;

    setStatus('converting');
    setProgress(0);
    setProgressMessage(`Iniciando motor ${engineToUse.moduleName}...`);
    setLogs([]);
    setShowErrorLogs(false);
    setErrorMessage('');
    setFailedEngineName('');
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      const manager = WorkerManager.getInstance();
      await manager.initialize();
      
      const result = await manager.convert(
        engineToUse.moduleId,
        { 
          fileData: fileData,
          targetFormat: '.' + target.toLowerCase(),
          originalName: file.name,
        },
        (p, msg) => {
          setProgress(p);
          if (msg) setProgressMessage(msg);
        },
        (msg) => {
          setLogs((prev) => [...prev.slice(-150), msg]);
          console.debug(msg);
        }
      );
      
      if (result && result.outputData) {
        const outputData = result.outputData as Uint8Array;
        const mimeType = (result.mimeType as string) || 'application/octet-stream';
        const blob = new Blob([outputData as unknown as BlobPart], { type: mimeType });
        setOutputUrl(URL.createObjectURL(blob));
        setOutputSize(outputData.byteLength);
      } else {
        throw new Error('Nenhum dado de saída retornado pelo motor de conversão.');
      }
      
      setStatus('done');
      setProgressMessage(undefined);
    } catch (error) {
      console.error(`[ConvertPanel] Falha no motor ${engineToUse.moduleName}:`, error);
      setFailedEngineName(engineToUse.moduleName);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setStatus('error');
    }
  }

  const outputName =
    file && target ? `${file.name.replace(/\.[^.]+$/, '')}.${target.toLowerCase()}` : '';

  if (!file) {
    return (
      <UploadDropzone
        onFile={(f) => {
          setFile(f);
          setSelectedEngineId(null);
        }}
        accept={accept}
        hint={hint ?? 'Suporta dezenas de formatos populares'}
      />
    );
  }

  return (
    <div className="space-y-5">
      <FilePreview file={file} onRemove={reset} />

      {status === 'idle' && !fixedTarget && (
        <section className="space-y-3">
          <Typography variant="h2" as="h2">
            Converter para
          </Typography>
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar formato..." />
          <CategoryFilter value={category} onChange={setCategory} />
          <FormatSelector
            formats={availableFormats}
            selected={selected}
            onSelect={(ext) => {
              setSelected(ext);
              setSelectedEngineId(null);
            }}
          />
        </section>
      )}

      {status === 'idle' && target && availableEngines.length > 0 && (
        <EngineSelector
          engines={availableEngines}
          selectedEngineId={activeEngine?.moduleId ?? null}
          onSelectEngine={setSelectedEngineId}
        />
      )}

      {status === 'idle' && (
        <Button
          variant="primary"
          size="md"
          disabled={!target || !activeEngine}
          onClick={() => start()}
        >
          {target ? `Converter para ${target}` : 'Selecione um formato'}
        </Button>
      )}

      {status === 'converting' && (
        <ConversionProgress
          progress={progress}
          target={target ?? ''}
          message={progressMessage}
          logs={logs}
        />
      )}

      {status === 'done' && (
        <DownloadResult
          fileName={outputName}
          size={outputSize}
          blobUrl={outputUrl ?? undefined}
          onReset={reset}
        />
      )}

      {status === 'error' && (
        <Card variant="alert-destructive" className="px-4 py-3.5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-destructive shrink-0" strokeWidth={1.75} />
            <Typography variant="body" className="font-medium text-foreground">
              Falha na conversão com {failedEngineName || 'o motor selecionado'}
            </Typography>
          </div>

          <Typography variant="code" color="muted" className="text-[12px] block">
            {errorMessage || 'O arquivo não pôde ser processado por este motor.'}
          </Typography>

          {/* User Decision: Offer alternate compatible engines if available */}
          {availableEngines.filter(e => e.moduleName !== failedEngineName).length > 0 && (
            <div className="pt-1">
              <Typography variant="caption" color="muted" className="mb-2 block font-medium">
                Deseja tentar com outro motor compatível?
              </Typography>
              <div className="flex flex-wrap gap-2">
                {availableEngines
                  .filter(e => e.moduleName !== failedEngineName)
                  .map(engine => (
                    <Button
                      key={engine.moduleId}
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedEngineId(engine.moduleId);
                        start(engine.moduleId);
                      }}
                    >
                      {engine.acceleration === 'instant-copy' && '⚡ '}
                      {engine.acceleration === 'cpu-multithread' && '🚀 '}
                      {engine.acceleration === 'gpu' && '⚡ '}
                      {engine.acceleration === 'cpu-singlethread' && '💻 '}
                      Usar {engine.moduleName}
                    </Button>
                  ))}
              </div>
            </div>
          )}

          {/* Log Viewer Toggle in Error State */}
          {logs.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowErrorLogs(!showErrorLogs)}
                className="focus-ring flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Terminal className="size-3" />
                <span>{showErrorLogs ? 'Ocultar Logs de Erro' : 'Ver Logs Técnicos do Motor'}</span>
                {showErrorLogs ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </button>
              {showErrorLogs && (
                <div className="mt-2 rounded-md border border-border bg-black/80 p-2.5 font-mono text-[10px] leading-relaxed text-zinc-300 max-h-40 overflow-y-auto space-y-0.5 select-text">
                  {logs.map((log, i) => (
                    <div key={i} className="break-all whitespace-pre-wrap">
                      <span className="text-destructive mr-1">&gt;</span>
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
            >
              Escolher outro arquivo
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
