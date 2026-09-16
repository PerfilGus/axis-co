import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/dashboard",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex shrink-0 items-center gap-2 text-fg transition-opacity hover:opacity-80",
        className,
      )}
      aria-label="Axis, ir para o início"
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent)] text-[13px] font-bold text-[var(--accent-fg)]">
        A
      </span>
      <span className="hidden text-[15px] font-medium tracking-tight sm:block">
        Axis
      </span>
    </Link>
  );
}
