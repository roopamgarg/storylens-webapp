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
    <header className="-mx-3 -mt-3 bg-transparent px-4 py-2 lg:px-5 lg:py-2">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:overflow-x-auto lg:whitespace-nowrap">
        <div className="flex items-center gap-3 lg:min-w-max">
          <h1 className="text-lg font-semibold">Narrative Consistency Checker</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:min-w-max lg:grid-cols-4">
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
