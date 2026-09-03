import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { UploadDropzone } from './UploadDropzone';
import { FilePreview } from './FilePreview';
import { SearchInput } from './SearchInput';
import { CategoryFilter } from './CategoryFilter';
import { FormatSelector } from './FormatSelector';
import { ConversionProgress } from './ConversionProgress';
import { DownloadResult } from './DownloadResult';
import { FORMATS, describeFile, type Format } from '@/lib/formats';
import { resolvePossibleConversions } from '@/modules/registry';
import { WorkerManager } from '@/core/engine/WorkerManager';
import { OPFSManager } from '@/core/fs/OPFSManager';

type Status = 'idle' | 'converting' | 'done' | 'error';

/**
 * ConvertPanel — Main conversion UI island.
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
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number>(0);
  
  // Track which module supports the selected target
  const activeModuleId = useRef<string | null>(null);

  const target = fixedTarget ?? selected;
  const sourceExt = file ? describeFile(file.name).ext : null;

  // Resolve possible conversions dynamically from the module registry
  const availableFormats: Format[] = (() => {
    if (sourceExt) {
      const possible = resolvePossibleConversions(sourceExt);
      const targetExts = new Set<string>();
      const extToModule = new Map<string, string>();
      
      possible.forEach(p => {
        p.toExtensions.forEach(ext => {
          targetExts.add(ext);
          extToModule.set(ext, p.moduleId);
        });
      });

      // Update the active module if a target is selected
      if (target && extToModule.has(target)) {
        activeModuleId.current = extToModule.get(target)!;
      } else {
        activeModuleId.current = null;
      }

      return FORMATS
        .filter(f => targetExts.has(f.ext))
        .filter((c) => {
          const matchesCategory = category === 'all' || c.category === category;
          const matchesQuery =
            c.ext.toLowerCase().includes(query.toLowerCase().trim()) ||
            c.label.toLowerCase().includes(query.toLowerCase().trim());
          return matchesCategory && matchesQuery;
        });
    }
    
    // No file yet — show all formats filtered by UI controls
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
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl(null);
    setOutputSize(0);
    if (!fixedTarget) setSelected(null);
  }

  async function start() {
    if (!file || !target || !activeModuleId.current) return;
    setStatus('converting');
    setProgress(0);
    setProgressMessage(`Initializing conversion to ${target}…`);
    
    try {
      const manager = WorkerManager.getInstance();
      await manager.initialize();
      
      const result = await manager.convert(
        activeModuleId.current,
        { 
          file: file, // We pass the file; WorkerManager/Worker handles writing it to OPFS or directly. Wait, the mock expects file directly.
          targetFormat: target,
          originalName: file.name
        },
        (p, msg) => {
          setProgress(p);
          if (msg) setProgressMessage(msg);
        },
        (msg) => {
          console.debug(msg);
        }
      );
      
      // In the real module (Step 3), result will contain the File or FileSystemFileHandle.
      // For now, mock a success Blob URL if there isn't a real file returned.
      if (result && result.outputFile instanceof File) {
        setOutputUrl(URL.createObjectURL(result.outputFile));
        setOutputSize(result.outputFile.size);
      } else {
        // Mock Blob for testing
        const blob = new Blob(['Mock conversion result for ' + file.name], { type: 'application/octet-stream' });
        setOutputUrl(URL.createObjectURL(blob));
        setOutputSize(blob.size);
      }
      
      setStatus('done');
      setProgressMessage(undefined);
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  }

  const outputName =
    file && target ? `${file.name.replace(/\.[^.]+$/, '')}${target.toLowerCase()}` : '';

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
          <h2 className="text-[13px] font-medium">Convert to</h2>
          <SearchInput value={query} onChange={setQuery} placeholder="Search formats…" />
          <CategoryFilter value={category} onChange={setCategory} />
          <FormatSelector formats={availableFormats} selected={selected} onSelect={setSelected} />
        </section>
      )}

      {status === 'idle' && (
        <button
          type="button"
          disabled={!target}
          onClick={start}
          className="focus-ring inline-flex h-9 items-center rounded-sm bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-muted-foreground"
        >
          {target ? `Convert to ${target}` : 'Select a format'}
        </button>
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
        <div className="rounded-md border border-destructive/40 bg-surface px-3 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-destructive" strokeWidth={1.75} />
            <p className="text-[13px] font-medium">Conversion failed</p>
          </div>
          <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
            The file could not be processed. Try another file.
          </p>
          <button
            type="button"
            onClick={reset}
            className="focus-ring mt-3 inline-flex h-8 items-center rounded-sm border border-border bg-surface px-3 text-[12px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            Start over
          </button>
        </div>
      )}
    </div>
  );
}

