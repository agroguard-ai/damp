import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

export type ButtonVariant = 'primary' | 'success' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  label?: string;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 border border-transparent shadow-sm',
  success:
    'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 dark:bg-green-600 dark:hover:bg-green-500 dark:active:bg-green-700 border border-transparent shadow-sm',
  secondary:
    'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 dark:active:bg-zinc-600 border border-zinc-200 dark:border-zinc-700 shadow-sm',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500 dark:active:bg-red-700 border border-transparent shadow-sm',
  warning:
    'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500 dark:active:bg-amber-700 border border-transparent shadow-sm',
  ghost:
    'bg-transparent text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:active:bg-zinc-700',
  outline:
    'bg-transparent border border-zinc-200 text-zinc-900 hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:active:bg-zinc-750',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5 font-medium',
  md: 'px-4 py-2 text-sm rounded-lg gap-2 font-medium',
  lg: 'px-5 py-3 text-base rounded-xl gap-2.5 font-semibold',
};

export function Button({
  href,
  label,
  icon: Icon,
  iconPosition = 'left',
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none outline-none';
  const sizeClasses = sizeStyles[size];
  const variantClasses = variantStyles[variant];

  const content = (
    <>
      {Icon && iconPosition === 'left' && <Icon className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} shrink-0`} />}
      {children || label}
      {Icon && iconPosition === 'right' && <Icon className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} shrink-0`} />}
    </>
  );

  const mergedClasses = `${baseClasses} ${sizeClasses} ${variantClasses} ${className}`.trim();

  if (href && !disabled) {
    return (
      <Link href={href} className={mergedClasses}>
        {content}
      </Link>
    );
  }

  return (
    <button className={mergedClasses} disabled={disabled} {...props}>
      {content}
    </button>
  );
}
