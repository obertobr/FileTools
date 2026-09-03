import { Archive, FileText, Film, Image as ImageIcon, Music, File, X } from 'lucide-react';
import { describeFile, formatBytes, type Category } from '@/lib/formats';

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
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-border bg-surface-raised text-muted-foreground">
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium">{file.name}</p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {formatBytes(file.size)} · {kind}
        </p>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove file"
          className="focus-ring ml-auto grid size-7 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
        >
          <X className="size-3.5" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
