import type { PaperDollSlot } from "@/lib/paperDoll/releaseContract";

export const RELEASE_WORKBENCH_VIEWS = [
  "assembly",
  "matrix",
  "lineup",
  "evidence",
  "publish",
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

function safeFilter(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return SAFE_FILTER.test(normalized) ? normalized : null;
}

export function parseReleaseWorkbenchState(params: URLSearchParams): ReleaseWorkbenchState {
  const requestedView = params.get("pdView");
  const view = RELEASE_WORKBENCH_VIEWS.includes(requestedView as ReleaseWorkbenchView)
    ? requestedView as ReleaseWorkbenchView
    : "assembly";
  const role = safeFilter(params.get("pdRole"));
  const status = safeFilter(params.get("pdStatus"));
  return {
    view,
    mode: "release-lock",
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
  params.set("pdView", state.view);
  for (const key of ["pdSystem", "pdRole", "pdFinish", "pdStatus"]) params.delete(key);
  if (state.filters.system) params.set("pdSystem", state.filters.system);
  if (state.filters.role) params.set("pdRole", state.filters.role);
  if (state.filters.finish) params.set("pdFinish", state.filters.finish);
  if (state.filters.status) params.set("pdStatus", state.filters.status);
  return params;
}
