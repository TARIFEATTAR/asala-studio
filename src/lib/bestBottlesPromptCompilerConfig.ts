import productFamiliesConfig from "../../config/product_families.json";
import materialModulesConfig from "../../config/material_modules.json";
import frameClassesConfig from "../../config/frame_classes.json";
import closureModulesConfig from "../../config/closure_modules.json";
import negativeRulesConfig from "../../config/negative_rules.json";
import masterTemplate from "../../prompts/master_pdp_prompt.md?raw";

import type {
  ClosureModule,
  FamilyModule,
  FrameModule,
  MaterialModule,
  ModuleConfig,
  NegativeRulesConfig,
  PromptSystem,
} from "./bestBottlesPromptCompiler";

const families = productFamiliesConfig as ModuleConfig<FamilyModule>;
const materials = materialModulesConfig as ModuleConfig<MaterialModule>;
const frames = frameClassesConfig as ModuleConfig<FrameModule>;
const closures = closureModulesConfig as ModuleConfig<ClosureModule>;
const negativeRules = negativeRulesConfig as NegativeRulesConfig;

export const BEST_BOTTLES_PROMPT_SYSTEM: PromptSystem = {
  masterTemplate,
  families: families.modules,
  materials: materials.modules,
  frames: frames.modules,
  closures: closures.modules,
  negativeRules: negativeRules.rules,
};
