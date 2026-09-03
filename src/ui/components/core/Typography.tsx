import React, { type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type TypographyVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'code';
export type TypographyColor = 'default' | 'muted' | 'primary' | 'destructive';

export interface TypographyProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  variant?: TypographyVariant;
  color?: TypographyColor;
  children?: ReactNode;
}

const variantStyles: Record<TypographyVariant, string> = {
  h1: 'text-[15px] font-medium tracking-tight',
  h2: 'text-[13px] font-medium tracking-tight',
  h3: 'text-[12px] font-medium tracking-tight',
  body: 'text-[13px] leading-relaxed',
  caption: 'text-[11px] leading-tight',
  code: 'font-mono text-[11px]',
};

const colorStyles: Record<TypographyColor, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  primary: 'text-primary',
  destructive: 'text-destructive',
};

const defaultElementMap: Record<TypographyVariant, ElementType> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  body: 'p',
  caption: 'span',
  code: 'code',
};

export function Typography({
  as,
  variant = 'body',
  color = variant === 'caption' || variant === 'code' ? 'muted' : 'default',
  className,
  children,
  ...props
}: TypographyProps) {
  const Component = as || defaultElementMap[variant] || 'p';

  return (
    <Component
      className={cn(variantStyles[variant], colorStyles[color], className)}
      {...props}
    >
      {children}
    </Component>
  );
}
