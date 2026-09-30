import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
export function Button({
  variant = "primary",
  busy = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      className={`button ${variant} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy ? <LoaderCircle className="spin" size={18} /> : null}
      {children}
    </button>
  );
}
