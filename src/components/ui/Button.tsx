import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "subtle" | "ghost" | "danger";
type Size = "xs" | "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-[6px] font-medium select-none whitespace-nowrap " +
  "transition-all duration-120 ease-app disabled:opacity-45 disabled:pointer-events-none " +
  "focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.985]";

const variants: Record<Variant, string> = {
  primary: "bg-text text-bg hover:bg-accent hover:text-bg hover:shadow-[0_1px_2px_rgba(0,0,0,0.3)]",
  subtle: "bg-surface-2 text-text border border-border hover:bg-active hover:border-border-strong",
  ghost: "text-muted hover:text-text hover:bg-hover",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white border border-transparent",
};

const sizes: Record<Size, string> = {
  xs: "h-6 px-2.5 text-xs [&_svg]:size-3.5",
  sm: "h-7 px-3.5 text-sm [&_svg]:size-3.5",
  md: "h-8 px-4 text-sm [&_svg]:size-4",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "subtle", size = "sm", ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "ghost" | "subtle";
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = "ghost", label, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-[6px] text-muted transition-colors duration-120 ease-app",
        "hover:bg-hover hover:text-text focus-visible:outline-2 focus-visible:outline-accent",
        variant === "subtle" && "border border-border bg-surface-2",
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";
