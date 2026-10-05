import React, { forwardRef } from "react";
import { BoxIcon } from "lucide-react";
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: BoxIcon;
}
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg hover:bg-primary/90',
  secondary: 'bg-elevated text-ink border border-line hover:border-muted/40',
  ghost: 'text-ink hover:bg-elevated',
  danger: 'bg-danger text-canvas hover:bg-danger/90'
};
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-[10px]',
  md: 'h-10 px-4 text-sm gap-2 rounded-control',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-control',
  icon: 'h-10 w-10 rounded-control',
  'icon-sm': 'h-8 w-8 rounded-[10px]'
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className = '',
  children,
  type = 'button',
  ...rest
}, ref) {
  return <button ref={ref} type={type} className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...rest}>
      {Icon && <Icon className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={2.25} aria-hidden />}
      {children}
    </button>;
});