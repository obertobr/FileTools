import { CATEGORIES } from '@/lib/formats';
import { Badge } from '@/ui/components/core';

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
        <Badge
          key={c.id}
          role="button"
          tabIndex={0}
          interactive
          selected={value === c.id}
          onClick={() => onChange(c.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onChange(c.id);
            }
          }}
        >
          {c.label}
        </Badge>
      ))}
    </div>
  );
}
