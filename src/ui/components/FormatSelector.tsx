import { Check } from 'lucide-react';
import type { Format } from '@/lib/formats';
import { cn } from '@/lib/utils';

export function FormatSelector({
  formats,
  selected,
  onSelect,
}: {
  formats: Format[];
  selected: string | null;
  onSelect: (ext: string) => void;
}) {
  if (formats.length === 0) {
    return (
      <p className="rounded-md border border-border bg-surface px-3 py-6 text-center font-mono text-[12px] text-muted-foreground">
        No matching formats
      </p>
    );
  }

  return (
    <div className="grid gap-1 sm:grid-cols-2">
      {formats.map((f) => {
        const active = selected === f.ext;
        return (
          <button
            key={f.ext}
            type="button"
            onClick={() => onSelect(f.ext)}
            className={cn(
              'focus-ring flex items-center gap-3 rounded-sm border px-3 py-2 text-left transition-colors',
              active
                ? 'border-primary/50 bg-accent-subtle/25'
                : 'border-border bg-surface hover:border-border-strong hover:bg-surface-raised',
            )}
          >
            <span className="min-w-0">
              <span
                className={cn(
                  'block font-mono text-[12px]',
                  active ? 'text-primary' : 'text-foreground',
                )}
              >
                {f.ext}
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                {f.label}
              </span>
            </span>
            {active && <Check className="ml-auto size-3.5 shrink-0 text-primary" strokeWidth={2} />}
          </button>
        );
      })}
    </div>
  );
}
