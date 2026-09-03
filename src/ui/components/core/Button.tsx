import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon-md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-muted-foreground',
  secondary:
    'border border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground disabled:opacity-50',
  outline:
    'border border-border bg-transparent text-foreground hover:border-border-strong hover:bg-surface disabled:opacity-50',
  ghost:
    'bg-transparent text-muted-foreground hover:bg-surface-raised hover:text-foreground disabled:opacity-50',
  destructive:
    'border border-destructive/50 bg-destructive-subtle/40 text-foreground hover:bg-destructive-subtle/70 disabled:opacity-50',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[12px] gap-1.5',
  md: 'h-9 px-4 text-[13px] gap-2',
  lg: 'h-10 px-5 text-[14px] gap-2.5',
  'icon-sm': 'size-7 p-0 place-items-center',
  'icon-md': 'size-8 p-0 place-items-center',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isIconButton = size.startsWith('icon');

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(
          'focus-ring inline-flex items-center justify-center rounded-sm font-medium transition-all select-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        {!isIconButton && children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
