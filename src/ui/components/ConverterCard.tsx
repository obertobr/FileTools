import { ArrowRight } from 'lucide-react';
import type { Converter } from '@/lib/formats';
import { Typography } from '@/ui/components/core';

export function ConverterCard({ converter }: { converter: Converter }) {
  const href = `/converter/${converter.slug}`;

  return (
    <a
      href={href}
      className="focus-ring group flex flex-col rounded-md border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface-raised"
    >
      <span className="flex items-center gap-1.5 font-mono text-[12px]">
        <Typography variant="code" color="default" as="span">
          {converter.from}
        </Typography>
        <ArrowRight className="size-3 text-muted-foreground transition-colors group-hover:text-primary" strokeWidth={1.75} />
        <Typography variant="code" color="default" as="span">
          {converter.to}
        </Typography>
      </span>
      <Typography variant="caption" color="muted" className="mt-1 text-[12px]">
        {converter.description}
      </Typography>
    </a>
  );
}
