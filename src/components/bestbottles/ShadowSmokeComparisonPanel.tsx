interface ShadowSmokeComparisonPanelProps {
  approvedImageUrl: string;
  candidateImageUrl: string;
}

export function ShadowSmokeComparisonPanel({
  approvedImageUrl,
  candidateImageUrl,
}: ShadowSmokeComparisonPanelProps) {
  return (
    <section
      className="space-y-3 rounded-sm border border-white/10 bg-[var(--darkroom-panel)] p-4"
      aria-label="Shadow smoke comparison"
    >
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Exact-SKU comparison</div>
        <div className="mt-1 text-[11px] text-white/60">Identical-scale review for the V6.1 model-shadow smoke SKU.</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <figure className="min-w-0 space-y-2">
          <figcaption className="text-[10px] uppercase tracking-[0.14em] text-white/55">Current approved · V6.0 rig shadow</figcaption>
          <div className="aspect-[2080/2288] overflow-hidden bg-white">
            <img src={approvedImageUrl} alt="Current approved V6.0 rig shadow" className="h-full w-full object-contain" />
          </div>
        </figure>
        <figure className="min-w-0 space-y-2">
          <figcaption className="text-[10px] uppercase tracking-[0.14em] text-white/55">Candidate · V6.1 model shadow</figcaption>
          <div className="aspect-[2080/2288] overflow-hidden bg-white">
            <img src={candidateImageUrl} alt="Candidate V6.1 model shadow" className="h-full w-full object-contain" />
          </div>
        </figure>
      </div>
    </section>
  );
}
