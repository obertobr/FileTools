import { CheckCircle2, Download, RotateCcw } from 'lucide-react';
import { formatBytes } from '@/lib/formats';

export function DownloadResult({
  fileName,
  size,
  /** Blob URL to the converted file (created by the Worker) */
  blobUrl,
  onReset,
}: {
  fileName: string;
  size: number;
  blobUrl?: string;
  onReset: () => void;
}) {
  function handleDownload() {
    const url = blobUrl ?? URL.createObjectURL(new Blob(['placeholder'], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    // Only revoke if we created a temporary blob (not the real one from the Worker)
    if (!blobUrl) URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-md border border-primary/30 bg-accent-subtle/15 px-3 py-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4 text-primary" strokeWidth={1.75} />
        <p className="text-[13px] font-medium">Conversion complete</p>
      </div>
      <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
        {fileName} · {formatBytes(size)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDownload}
          className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-sm bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Download className="size-3.5" strokeWidth={2} />
          Download
        </button>
        <button
          type="button"
          onClick={onReset}
          className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-sm border border-border bg-surface px-3 text-[12px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          <RotateCcw className="size-3.5" strokeWidth={1.75} />
          Convert another
        </button>
      </div>
    </div>
  );
}
