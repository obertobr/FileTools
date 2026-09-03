import { Search } from 'lucide-react';

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.75}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="focus-ring h-8 w-full rounded-sm border border-border bg-surface pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground"
      />
    </div>
  );
}
