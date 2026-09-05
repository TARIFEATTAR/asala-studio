import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withWritingAi } from "../_shared/writingAiEdge.ts";
import { createCompetitiveIntelligenceHandler } from "./handler.ts";

serve(withWritingAi(createCompetitiveIntelligenceHandler()));
