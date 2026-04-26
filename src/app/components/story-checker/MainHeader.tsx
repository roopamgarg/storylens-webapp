"use client";

import { TopMetric } from "./TopMetric";

type MainHeaderProps = {
  loading: boolean;
  elapsedLabel: string;
  eventsCount: number;
  issuesTotal: number;
  issuesErrors: number;
  issuesWarnings: number;
};

export function MainHeader(props: MainHeaderProps) {
  return (
    <header className="-mx-3 -mt-3 px-4 py-2 shadow-[0_16px_40px_-30px_rgba(59,130,246,0.7)] lg:px-5 lg:py-2">
      <div className="flex items-center justify-between gap-3 overflow-x-auto whitespace-nowrap">
        <div className="flex min-w-max items-center gap-3">
          <h1 className="text-lg font-semibold">Narrative Consistency Checker</h1>
        </div>
        <div className="grid min-w-max grid-cols-4 gap-2">
          <TopMetric label="Last run" value={props.loading ? props.elapsedLabel : "Ready"} />
          <TopMetric label="Events" value={String(props.eventsCount)} />
          <TopMetric
            label="Issues"
            value={String(props.issuesTotal)}
            tone={props.issuesErrors > 0 ? "error" : "neutral"}
          />
          <TopMetric
            label="Warnings"
            value={String(props.issuesWarnings)}
            tone={props.issuesWarnings > 0 ? "warning" : "neutral"}
          />
        </div>
      </div>
    </header>
  );
}
