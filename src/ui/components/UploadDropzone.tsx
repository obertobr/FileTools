import { useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';

export function UploadDropzone({
  onFile,
  accept,
  hint = 'Supports many file formats',
}: {
  onFile: (file: File) => void;
  accept?: string | undefined;
  hint?: string | undefined;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Drop a file here or browse your files"
      className={cn(
        'focus-ring flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-6 py-16 text-center transition-colors sm:py-20 select-none',
        dragging
          ? 'border-primary bg-accent-subtle/20'
          : 'border-border bg-surface hover:border-border-strong hover:bg-surface/80',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      <span
        className={cn(
          'grid size-8 place-items-center rounded-sm border transition-colors',
          dragging ? 'border-primary text-primary bg-accent-subtle/30' : 'border-border text-muted-foreground bg-surface-raised',
        )}
      >
        <ArrowUp className="size-4" strokeWidth={1.75} />
      </span>
      <Typography variant="body" className="mt-4 font-medium">
        Drop a file here
      </Typography>
      <Typography variant="body" color="muted" className="mt-0.5">
        or click to browse
      </Typography>
      <Typography variant="code" color="muted" className="mt-6">
        {hint}
      </Typography>
      <Typography variant="code" color="muted" className="mt-1 opacity-70">
        Your file stays on your device (100% local)
      </Typography>
    </div>
  );
}
