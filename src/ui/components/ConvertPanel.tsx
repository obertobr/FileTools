import { useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { UploadDropzone } from './UploadDropzone';
import { FilePreview } from './FilePreview';
import { SearchInput } from './SearchInput';
import { CategoryFilter } from './CategoryFilter';
import { FormatSelector } from './FormatSelector';
import { ConversionProgress } from './ConversionProgress';
import { DownloadResult } from './DownloadResult';
import { Button, Card, Typography } from '@/ui/components/core';
import { FORMATS, describeFile, type Format } from '@/lib/formats';
import { resolvePossibleConversions } from '@/modules/registry';
import { WorkerManager } from '@/core/engine/WorkerManager';

type Status = 'idle' | 'converting' | 'done' | 'error';

/**
 * ConvertPanel - Main conversion UI island.
 * Built strictly on top of FileTools Core Design System components.
 */
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
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number>(0);
  
  const activeModuleId = useRef<string | null>(null);

  const target = fixedTarget ?? selected;
  const sourceExt = file ? describeFile(file.name).ext : null;

  // Resolve possible conversions dynamically from the module registry
  const availableFormats: Format[] = (() => {
    if (sourceExt && file) {
      const possible = resolvePossibleConversions(sourceExt, file.type);
      const targetExts = new Set<string>();
      const extToModule = new Map<string, string>();
      
      possible.forEach(p => {
        p.toExtensions.forEach(ext => {
          const normalizedExt = ext.replace('.', '').toUpperCase();
          targetExts.add(normalizedExt);
          extToModule.set(normalizedExt, p.moduleId);
        });
      });

      if (target && extToModule.has(target)) {
        activeModuleId.current = extToModule.get(target)!;
      } else {
        activeModuleId.current = null;
      }

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

  function reset() {
    setFile(null);
    setStatus('idle');
    setProgress(0);
    setProgressMessage(undefined);
    setErrorMessage('');
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl(null);
    setOutputSize(0);
    if (!fixedTarget) setSelected(null);
  }

  async function start() {
    if (!file || !target || !activeModuleId.current) return;
    setStatus('converting');
    setProgress(0);
    setProgressMessage(`Preparing file...`);
    setErrorMessage('');
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      const manager = WorkerManager.getInstance();
      await manager.initialize();
      
      const result = await manager.convert(
        activeModuleId.current,
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
        throw new Error('No output data returned from conversion module.');
      }
      
      setStatus('done');
      setProgressMessage(undefined);
    } catch (error) {
      console.error('[ConvertPanel] Conversion failed:', error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setStatus('error');
    }
  }

  const outputName =
    file && target ? `${file.name.replace(/\.[^.]+$/, '')}.${target.toLowerCase()}` : '';

  if (!file) {
    return (
      <UploadDropzone
        onFile={(f) => setFile(f)}
        accept={accept}
        hint={hint ?? 'Supports many file formats'}
      />
    );
  }

  return (
    <div className="space-y-5">
      <FilePreview file={file} onRemove={reset} />

      {status === 'idle' && !fixedTarget && (
        <section className="space-y-3">
          <Typography variant="h2" as="h2">
            Convert to
          </Typography>
          <SearchInput value={query} onChange={setQuery} placeholder="Search formats..." />
          <CategoryFilter value={category} onChange={setCategory} />
          <FormatSelector formats={availableFormats} selected={selected} onSelect={setSelected} />
        </section>
      )}

      {status === 'idle' && (
        <Button
          variant="primary"
          size="md"
          disabled={!target}
          onClick={start}
        >
          {target ? `Convert to ${target}` : 'Select a format'}
        </Button>
      )}

      {status === 'converting' && (
        <ConversionProgress
          progress={progress}
          target={target ?? ''}
          message={progressMessage}
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
        <Card variant="alert-destructive" className="px-3.5 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-destructive shrink-0" strokeWidth={1.75} />
            <Typography variant="body" className="font-medium text-foreground">
              Conversion failed
            </Typography>
          </div>
          <Typography variant="code" color="muted" className="mt-1.5 block">
            {errorMessage || 'The file could not be processed. Try another file.'}
          </Typography>
          <Button
            variant="secondary"
            size="sm"
            onClick={reset}
            className="mt-3"
          >
            Start over
          </Button>
        </Card>
      )}
    </div>
  );
}
