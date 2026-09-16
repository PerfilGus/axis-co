import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full rounded-[var(--radius-input)] border border-border bg-surface-input px-3.5 text-sm text-fg",
        "placeholder:text-muted-fg/70 transition-colors outline-none",
        "hover:border-border-strong focus:border-[var(--accent)] focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-[var(--radius-input)] border border-border bg-surface-input px-3.5 py-2.5 text-sm text-fg",
        "placeholder:text-muted-fg/70 resize-y transition-colors outline-none",
        "hover:border-border-strong focus:border-[var(--accent)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
