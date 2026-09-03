import { Check } from 'lucide-react';
import type { Format } from '@/lib/formats';
import { Card, Typography } from '@/ui/components/core';
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
      <Card variant="default" className="py-6 text-center">
        <Typography variant="code" color="muted">
          No matching formats
        </Typography>
      </Card>
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
            <span className="min-w-0 flex-1">
              <Typography
                variant="code"
                color={active ? 'primary' : 'default'}
                className="block text-[12px]"
              >
                {f.ext}
              </Typography>
              <Typography
                variant="caption"
                color="muted"
                className="mt-0.5 block truncate text-[12px]"
              >
                {f.label}
              </Typography>
            </span>
            {active && <Check className="ml-auto size-3.5 shrink-0 text-primary" strokeWidth={2} />}
          </button>
        );
      })}
    </div>
  );
}
