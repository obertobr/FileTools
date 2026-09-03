import { CheckCircle2, Download, RotateCcw } from 'lucide-react';
import { formatBytes } from '@/lib/formats';
import { Card, Typography, Button } from '@/ui/components/core';

export function DownloadResult({
  fileName,
  size,
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
    if (!blobUrl) URL.revokeObjectURL(url);
  }

  return (
    <Card variant="alert-success" className="px-3.5 py-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4 text-primary" strokeWidth={1.75} />
        <Typography variant="body" className="font-medium text-foreground">
          Conversion complete
        </Typography>
      </div>
      <Typography variant="code" color="muted" className="mt-2 block truncate">
        {fileName} · {formatBytes(size)}
      </Typography>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handleDownload}
          leftIcon={<Download className="size-3.5" strokeWidth={2} />}
        >
          Download
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onReset}
          leftIcon={<RotateCcw className="size-3.5" strokeWidth={1.75} />}
        >
          Convert another
        </Button>
      </div>
    </Card>
  );
}
