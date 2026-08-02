import { Check, CircleSlash2, Clock3 } from "lucide-react";

import type { ReleasePhase } from "./publishPreviewModel";

interface ReleaseGateSummaryProps { phases: ReleasePhase[] }

export function ReleaseGateSummary({ phases }: ReleaseGateSummaryProps) {
  return (
    <ol className="pdw-gate-list">
      {phases.map((phase) => (
        <li className={`pdw-gate pdw-gate--${phase.status}`} key={phase.key}>
          <span className="pdw-gate-number">{String(phase.index).padStart(2, "0")}</span>
          <span className="pdw-gate-icon">
            {phase.status === "passed" ? <Check /> : phase.status === "blocked" ? <CircleSlash2 /> : <Clock3 />}
          </span>
          <div><strong>{phase.label}</strong><span>{phase.detail}</span></div>
          <b>{phase.status.replace("-", " ")}</b>
        </li>
      ))}
    </ol>
  );
}
