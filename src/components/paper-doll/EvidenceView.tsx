import { useMemo, useState } from "react";
import { CheckCircle2, Search, ShieldAlert } from "lucide-react";

import type { PaperDollReleaseManifest } from "@/lib/paperDoll/releaseContract";

interface EvidenceViewProps { manifest: PaperDollReleaseManifest }

export function EvidenceView({ manifest }: EvidenceViewProps) {
  const [query, setQuery] = useState("");
  const evidence = useMemo(() => {
    const target = query.trim().toLowerCase();
    if (!target) return manifest.qaEvidence;
    return manifest.qaEvidence.filter((item) =>
      [item.evidenceId, item.subjectId, item.gateKey, item.status, ...item.calibratedWith, ...item.issues]
        .some((value) => value.toLowerCase().includes(target)),
    );
  }, [manifest.qaEvidence, query]);

  return (
    <div className="pdw-evidence-view">
      <div className="pdw-view-heading">
        <div>
          <span className="pdw-kicker">Measured evidence</span>
          <h3>{manifest.qaEvidence.length} recorded gates</h3>
          <p>Every blocking gate names its calibration fixtures and measured result.</p>
        </div>
        <label className="pdw-evidence-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find gate, subject, fixture…" /></label>
      </div>

      <div className="pdw-evidence-list">
        {evidence.map((item) => (
          <article className={`pdw-evidence-card pdw-evidence-card--${item.status}`} key={item.evidenceId}>
            <div className="pdw-evidence-status">
              {item.status === "passed" ? <CheckCircle2 /> : <ShieldAlert />}
              <span>{item.status}</span>
            </div>
            <div className="pdw-evidence-main">
              <div className="pdw-evidence-title"><span>{item.gateKey}</span><b>v{item.gateVersion}</b>{item.blocking && <em>Blocking</em>}</div>
              <code>{item.subjectId}</code>
              <div className="pdw-fixture-list"><span>Calibrated with</span>{item.calibratedWith.map((fixture) => <code key={fixture}>{fixture}</code>)}</div>
              {item.issues.length > 0 && <div className="pdw-issue-list">{item.issues.map((issue) => <span key={issue}>{issue}</span>)}</div>}
            </div>
            <pre>{JSON.stringify(item.measurements, null, 2)}</pre>
          </article>
        ))}
        {evidence.length === 0 && <div className="pdw-no-results">No evidence matches “{query}”. Clear the search to restore all gates.</div>}
      </div>
    </div>
  );
}
