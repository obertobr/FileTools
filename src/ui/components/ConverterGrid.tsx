import type { Converter } from '@/lib/formats';
import { ConverterCard } from './ConverterCard';

export function ConverterGrid({ converters }: { converters: Converter[] }) {
  if (converters.length === 0) {
    return (
      <p className="rounded-md border border-border bg-surface px-3 py-10 text-center font-mono text-[12px] text-muted-foreground">
        No converters match your search
      </p>
    );
  }

  return (
    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
      {converters.map((c) => (
        <ConverterCard key={c.slug} converter={c} />
      ))}
    </div>
  );
}
