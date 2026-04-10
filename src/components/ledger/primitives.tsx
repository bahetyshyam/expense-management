import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string }>;

export function Surface({
  children,
  className,
  tone = "light",
}: {
  children: ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[2rem] border shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl",
        tone === "dark"
          ? "border-white/10 bg-neutral-950 text-white"
          : "border-white/70 bg-white/75 text-neutral-950",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ProductBadge({
  children,
  icon: Icon,
  tone = "light",
}: {
  children: ReactNode;
  icon?: IconType;
  tone?: "light" | "dark";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        tone === "dark"
          ? "border-white/10 bg-white/10 text-neutral-200"
          : "border-teal-900/10 bg-teal-50 text-teal-800"
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </div>
  );
}

export function IconTile({
  icon: Icon,
  tone = "dark",
  className,
}: {
  icon: IconType;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl shadow-xl",
        tone === "dark"
          ? "bg-neutral-950 text-white shadow-neutral-900/20"
          : "bg-white text-neutral-950 shadow-black/10",
        className
      )}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}

export function StatCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
      ? "text-rose-600"
      : "text-neutral-950";

  return (
    <Surface className="rounded-[1.35rem] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </div>
      <div className={cn("mt-2 text-3xl font-semibold tracking-[-0.04em]", toneClass)}>
        {value}
      </div>
      <div className="mt-1 text-xs leading-5 text-neutral-500">{helper}</div>
    </Surface>
  );
}

export function FeatureTile({
  title,
  text,
  icon: Icon,
}: {
  title: string;
  text: string;
  icon: IconType;
}) {
  return (
    <div className="rounded-2xl border border-neutral-950/10 bg-white/75 p-4 shadow-sm">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-950 text-white">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-sm font-semibold text-neutral-950">{title}</div>
      <div className="mt-1 text-xs leading-5 text-neutral-500">{text}</div>
    </div>
  );
}
