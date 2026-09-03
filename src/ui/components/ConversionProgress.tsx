export function ConversionProgress({
  progress,
  target,
  message,
}: {
  progress: number;
  target: string;
  message?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-3">
      <div className="flex items-center justify-between font-mono text-[11px]">
        <span className="text-muted-foreground">
          {message ?? `Converting to ${target}`}
        </span>
        <span className="text-primary">{Math.round(progress)}%</span>
      </div>
      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-surface-raised">
        <div
          className="h-full bg-primary transition-[width] duration-200 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
