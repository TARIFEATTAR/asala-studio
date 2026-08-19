import generatedRoute from "@/generated/paperDoll/cyl9ProductionRoute.generated.json";
import { parseProductionRouteArtifact } from "@/lib/paperDoll/productionRoute";

export const cyl9ProductionRoute = parseProductionRouteArtifact(generatedRoute);
