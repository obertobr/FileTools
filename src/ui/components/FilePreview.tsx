import { Archive, FileText, Film, Image as ImageIcon, Music, File, X } from 'lucide-react';
import { describeFile, formatBytes, type Category } from '@/lib/formats';
import { Card, Typography, Button } from '@/ui/components/core';

const icons: Record<Category, typeof File> = {
  video: Film,
  audio: Music,
  image: ImageIcon,
  document: FileText,
  archive: Archive,
  other: File,
};

export function FilePreview({ file, onRemove }: { file: File; onRemove?: () => void }) {
  const { category, kind } = describeFile(file.name);
  const Icon = icons[category];

  return (
    <Card variant="default" className="flex items-center gap-3 px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-border bg-surface-raised text-muted-foreground">
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <Typography variant="body" className="truncate font-medium">
          {file.name}
        </Typography>
        <Typography variant="code" color="muted" className="mt-0.5">
          {formatBytes(file.size)} · {kind}
        </Typography>
      </div>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label="Remove file"
          className="ml-auto"
        >
          <X className="size-3.5" strokeWidth={1.75} />
        </Button>
      )}
    </Card>
  );
}
