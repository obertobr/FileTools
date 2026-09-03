import React, { type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className="relative flex w-full items-center">
        {leftIcon && (
          <div className="pointer-events-none absolute left-2.5 flex items-center text-muted-foreground">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'focus-ring h-8 w-full rounded-sm border border-border bg-surface px-3 text-[13px] text-foreground placeholder:text-muted-foreground transition-colors',
            leftIcon && 'pl-8',
            rightIcon && 'pr-8',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-2.5 flex items-center text-muted-foreground">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
