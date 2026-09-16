"use client";

import * as React from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const Menu = DropdownPrimitive.Root;
export const MenuGatilho = DropdownPrimitive.Trigger;
export const MenuGrupo = DropdownPrimitive.Group;

export function MenuConteudo({
  className,
  sideOffset = 8,
  align = "end",
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 min-w-52 overflow-hidden rounded-[var(--radius-card-sm)] border border-border bg-surface-2 p-1.5",
          "data-[state=open]:[animation:axis-in_140ms_ease-out]",
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function MenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.Item>) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-full px-3 py-2 text-sm text-fg outline-none",
        "focus:bg-surface-3 data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
        "[&_svg]:size-4 [&_svg]:text-muted-fg",
        className,
      )}
      {...props}
    />
  );
}

export function MenuRotulo({
  className,
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.Label>) {
  return (
    <DropdownPrimitive.Label
      className={cn("px-3 pt-2 pb-1 text-[11px] font-medium text-muted-fg", className)}
      {...props}
    />
  );
}

export function MenuSeparador({
  className,
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.Separator>) {
  return (
    <DropdownPrimitive.Separator
      className={cn("my-1.5 h-px bg-border", className)}
      {...props}
    />
  );
}
