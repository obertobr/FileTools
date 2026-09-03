import type { Converter } from '@/lib/formats';

export function ConverterCard({ converter }: { converter: Converter }) {
  const href = `/converter/${converter.slug}`;

  return (
    <a
      href={href}
      className="focus-ring group flex flex-col rounded-sm border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface-raised"
    >
      <span className="flex items-center gap-1.5 font-mono text-[12px]">
        <span>{converter.from}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="size-3 text-muted-foreground transition-colors group-hover:text-primary"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
        <span>{converter.to}</span>
      </span>
      <span className="mt-1 text-[12px] text-muted-foreground">{converter.description}</span>
    </a>
  );
}
