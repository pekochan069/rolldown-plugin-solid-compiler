import type { JsxCompilerOptions } from "./options.js";

export const pluginName = "rolldown-plugin-solid-compiler";

export const solidPreset: JsxCompilerOptions = {
  moduleName: "@solidjs/web",
  builtIns: [
    "For",
    "Show",
    "Switch",
    "Match",
    "Loading",
    "Reveal",
    "Portal",
    "Repeat",
    "Dynamic",
    "Errored",
  ],
  contextToCustomElements: true,
  wrapConditionals: true,
  generate: "dom",
  hydratable: false,
  dev: false,
};
