import type { PaperDollSlot } from "@/lib/paperDoll/releaseContract";

export const RELEASE_WORKBENCH_VIEWS = [
  "inventory",
  "plate",
  "candidate",
  "family-fit",
  "release",
  "sanity",
] as const;

export type ReleaseWorkbenchView = (typeof RELEASE_WORKBENCH_VIEWS)[number];
export type ReleaseWorkbenchStatusFilter =
  | "missing"
  | "candidate"
  | "qa-passed"
  | "approved"
  | "in-release"
  | "blocked"
  | "rejected"
  | "published";

export interface ReleaseWorkbenchState {
  view: ReleaseWorkbenchView;
  mode: "release-lock";
  familyKey: string;
  componentKey: string | null;
  candidateId: string | null;
  bodyVariantKey: string | null;
  filters: {
    system: string | null;
    role: PaperDollSlot | null;
    finish: string | null;
    status: ReleaseWorkbenchStatusFilter | null;
  };
}

const SLOT_VALUES = new Set<PaperDollSlot>([
  "body",
  "cap",
  "roller",
  "sprayer",
  "overcap",
  "pump",
]);
const STATUS_VALUES = new Set<ReleaseWorkbenchStatusFilter>([
  "missing",
  "candidate",
  "qa-passed",
  "approved",
  "in-release",
  "blocked",
  "rejected",
  "published",
]);
const SAFE_FILTER = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SAFE_IDENTITY = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/;

function safeFilter(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return SAFE_FILTER.test(normalized) ? normalized : null;
}

function safeIdentity(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return SAFE_IDENTITY.test(normalized) ? normalized : null;
}

export function parseReleaseWorkbenchState(params: URLSearchParams): ReleaseWorkbenchState {
  const requestedView = params.get("view") ?? params.get("pdView");
  const view = RELEASE_WORKBENCH_VIEWS.includes(requestedView as ReleaseWorkbenchView)
    ? requestedView as ReleaseWorkbenchView
    : "inventory";
  const role = safeFilter(params.get("pdRole"));
  const status = safeFilter(params.get("pdStatus"));
  return {
    view,
    mode: "release-lock",
    familyKey: safeIdentity(params.get("family")) ?? "CYL-9ML",
    componentKey: safeIdentity(params.get("component")),
    candidateId: safeIdentity(params.get("candidate")),
    bodyVariantKey: safeIdentity(params.get("plate")),
    filters: {
      system: safeFilter(params.get("pdSystem")),
      role: role && SLOT_VALUES.has(role as PaperDollSlot) ? role as PaperDollSlot : null,
      finish: safeFilter(params.get("pdFinish")),
      status: status && STATUS_VALUES.has(status as ReleaseWorkbenchStatusFilter)
        ? status as ReleaseWorkbenchStatusFilter
        : null,
    },
  };
}

export function serializeReleaseWorkbenchState(
  state: ReleaseWorkbenchState,
  base: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const params = new URLSearchParams(base);
  params.delete("pdView");
  params.set("view", state.view);
  for (const key of ["family", "component", "candidate", "plate"]) params.delete(key);
  params.set("family", state.familyKey);
  if (state.componentKey) params.set("component", state.componentKey);
  if (state.candidateId) params.set("candidate", state.candidateId);
  if (state.bodyVariantKey) params.set("plate", state.bodyVariantKey);
  for (const key of ["pdSystem", "pdRole", "pdFinish", "pdStatus"]) params.delete(key);
  if (state.filters.system) params.set("pdSystem", state.filters.system);
  if (state.filters.role) params.set("pdRole", state.filters.role);
  if (state.filters.finish) params.set("pdFinish", state.filters.finish);
  if (state.filters.status) params.set("pdStatus", state.filters.status);
  return params;
}
