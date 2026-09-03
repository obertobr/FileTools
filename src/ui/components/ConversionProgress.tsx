import { useState, useEffect, useRef } from 'react';
import { Terminal, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Card, Typography, Button } from '@/ui/components/core';

export interface ConversionProgressProps {
  progress: number;
  target: string;
  message?: string;
  logs?: string[];
}

export function ConversionProgress({
  progress,
  target,
  message,
  logs = [],
}: ConversionProgressProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  const roundedProgress = Math.round(progress);
  const isIndeterminate = roundedProgress <= 5;

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (showLogs && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  function copyLogs() {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card variant="raised" className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Typography variant="body" className="font-medium truncate">
            {message || `Processando conversão para ${target}...`}
          </Typography>
          <Typography variant="caption" color="muted" className="mt-0.5 block">
            Tempo decorrido: {formatTime(elapsedSeconds)}
          </Typography>
        </div>

        <div className="shrink-0 text-right">
          {roundedProgress > 0 && (
            <Typography variant="code" color="primary" className="font-bold text-sm">
              {roundedProgress}%
            </Typography>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div
        role="progressbar"
        aria-valuenow={roundedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface"
      >
        {isIndeterminate ? (
          <div className="h-full w-full bg-gradient-to-r from-primary/20 via-primary to-primary/20 animate-[pulse_1.5s_ease-in-out_infinite]" />
        ) : (
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${roundedProgress}%` }}
          />
        )}
      </div>

      {/* Terminal / Live Logs Toggle */}
      <div className="pt-1 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowLogs(!showLogs)}
          className="focus-ring flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Terminal className="size-3.5" />
          <span>{showLogs ? 'Ocultar Terminal de Logs' : 'Ver Logs do Módulo'}</span>
          {showLogs ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>

        {showLogs && logs.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={copyLogs}
            className="h-6 text-[11px] px-2 py-0"
          >
            {copied ? (
              <>
                <Check className="size-3 text-primary mr-1" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="size-3 mr-1" />
                Copiar Logs
              </>
            )}
          </Button>
        )}
      </div>

      {/* Live Terminal Log Drawer */}
      {showLogs && (
        <div className="rounded-md border border-border bg-black/70 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-300 max-h-48 overflow-y-auto space-y-0.5 select-text">
          {logs.length === 0 ? (
            <div className="text-zinc-500 italic">Aguardando saída do motor...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="break-all whitespace-pre-wrap">
                <span className="text-primary/70 select-none mr-1.5">&gt;</span>
                {log}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      )}
    </Card>
  );
}
