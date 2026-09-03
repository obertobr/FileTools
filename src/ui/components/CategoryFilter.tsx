import { CATEGORIES } from '@/lib/formats';
import { cn } from '@/lib/utils';

export function CategoryFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={cn(
            'focus-ring shrink-0 rounded-sm border px-2.5 py-1 text-[12px] transition-colors',
            value === c.id
              ? 'border-primary/40 bg-accent-subtle/30 text-primary'
              : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
