import React, { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'destructive' | 'outline';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  interactive?: boolean;
  selected?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'border-border bg-surface text-muted-foreground',
  primary: 'border-primary/40 bg-accent-subtle/30 text-primary',
  secondary: 'border-border bg-surface-raised text-foreground',
  destructive: 'border-destructive/40 bg-destructive-subtle/30 text-destructive',
  outline: 'border-border bg-transparent text-muted-foreground',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-[12px]',
};

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  interactive = false,
  selected = false,
  ...props
}: BadgeProps) {
  const activeStyle = selected
    ? 'border-primary/50 bg-accent-subtle/40 text-primary shadow-xs'
    : '';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 shrink-0 rounded-sm border font-medium transition-colors select-none',
        sizeStyles[size],
        variantStyles[variant],
        interactive && 'focus-ring cursor-pointer hover:border-border-strong hover:text-foreground',
        activeStyle,
        className
      )}
      {...props}
    />
  );
}
