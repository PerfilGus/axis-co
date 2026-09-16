import { cn } from "@/lib/utils";

export function Esqueleto({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-[var(--radius-input)] bg-surface-3", className)}
      {...props}
    />
  );
}
