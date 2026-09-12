"use client";

import { BrandMark } from "./BrandMark";
import { cn } from "@/lib/cn";

/**
 * Official ZEV wordmark lockup: circular Z emblem + dominant ZEV stacked
 * over a compact LOCK with hairline rules. One component so splash, login,
 * and admin share identical geometry. Text content unchanged.
 */
export function Wordmark({
  size = "md",
  align = "center",
}: {
  size?: "sm" | "md" | "lg";
  align?: "center" | "left";
}) {
  const logo = size === "sm" ? 30 : size === "lg" ? 76 : 44;
  const zev = size === "sm" ? "text-[15px]" : size === "lg" ? "text-[34px]" : "text-[20px]";
  return (
    <span className={cn("flex items-center gap-2.5", align === "center" && "justify-center")}>
      <BrandMark size={logo} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-black tracking-[0.3em] text-white", zev)}>ZEV</span>
        <span className="mt-1.5 flex items-center gap-1.5" aria-hidden="true">
          <span className="h-px w-4 bg-purple-300/60" />
          <span className="text-[9px] font-bold tracking-[0.42em] text-purple-300">LOCK</span>
        </span>
      </span>
    </span>
  );
}
