import { Card, Typography } from '@/ui/components/core';

export function ConversionProgress({
  progress,
  target,
  message,
}: {
  progress: number;
  target: string;
  message?: string;
}) {
  const roundedProgress = Math.round(progress);

  return (
    <Card variant="default" className="px-3.5 py-3">
      <div className="flex items-center justify-between">
        <Typography variant="code" color="muted">
          {message ?? `Converting to ${target}`}
        </Typography>
        <Typography variant="code" color="primary" className="font-semibold">
          {roundedProgress}%
        </Typography>
      </div>
      <div
        role="progressbar"
        aria-valuenow={roundedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-surface-raised"
      >
        <div
          className="h-full bg-primary transition-[width] duration-200 ease-linear"
          style={{ width: `${roundedProgress}%` }}
        />
      </div>
    </Card>
  );
}
