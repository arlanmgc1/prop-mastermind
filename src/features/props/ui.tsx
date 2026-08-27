import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function Panel({
  title,
  badge,
  children,
  dashed,
  className,
}: {
  title: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  dashed?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("card-surface p-3.5", dashed && "panel-dashed", className)}>
      <header className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-secondary text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function Stat({
  label,
  value,
  tip,
  accent,
}: {
  label: string;
  value: ReactNode;
  tip?: string;
  accent?: boolean;
}) {
  const row = (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("num text-xs", accent ? "text-primary" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
  if (!tip) return row;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">{row}</div>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">{tip}</TooltipContent>
    </Tooltip>
  );
}

export function Tag({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "primary" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  const tones = {
    muted: "bg-secondary text-muted-foreground",
    primary: "bg-primary text-primary-foreground",
    success: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground",
    danger: "bg-destructive text-destructive-foreground",
  } as const;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", tones[tone])}>
      {children}
    </span>
  );
}
