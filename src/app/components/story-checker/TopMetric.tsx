"use client";

type TopMetricProps = {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "error";
};

export function TopMetric(props: TopMetricProps) {
  const toneClass =
    props.tone === "error"
      ? "border-red-500/40 bg-red-500/10 text-red-100"
      : props.tone === "warning"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
        : "border-white/15 bg-white/5 text-zinc-100";
  return (
    <div className={`rounded-xl border px-2.5 py-1.5 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide text-zinc-400">{props.label}</p>
      <p className="text-xs font-semibold">{props.value}</p>
    </div>
  );
}
