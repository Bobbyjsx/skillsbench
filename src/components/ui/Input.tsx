import { forwardRef, type InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helpText, leftIcon, rightIcon, wrapperClassName, ...props }, ref) => {
    return (
      <div className={cn("w-full flex flex-col gap-1.5", wrapperClassName)}>
        {label && <label className="text-xs font-medium text-text select-none">{label}</label>}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-2.5 flex items-center justify-center text-faint">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "h-8 w-full rounded-[6px] border border-border bg-surface-2 px-3 text-sm text-text",
              "placeholder:text-faint transition-colors duration-120 ease-app",
              "hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft",
              leftIcon && "pl-8",
              rightIcon && "pr-8",
              error && "border-danger focus:border-danger focus:ring-danger/20",
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-2.5 flex items-center justify-center text-faint">
              {rightIcon}
            </div>
          )}
        </div>
        {(error || helpText) && (
          <div className={cn("text-xs", error ? "text-danger" : "text-faint")}>
            {error || helpText}
          </div>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export const SearchInput = forwardRef<HTMLInputElement, InputProps & { onEscape?: () => void }>(
  ({ className, onKeyDown, onEscape, ...props }, ref) => (
    <Input
      ref={ref}
      leftIcon={<Search className="size-3.5" />}
      onKeyDown={(e) => {
        if (e.key === "Escape" && onEscape) onEscape();
        onKeyDown?.(e);
      }}
      className={cn("bg-bg", className)}
      {...props}
    />
  ),
);
SearchInput.displayName = "SearchInput";
