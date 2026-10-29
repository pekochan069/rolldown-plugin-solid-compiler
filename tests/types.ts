import type { JsxCompilerOptions, JsxPluginOptions } from "../src/index.js";

const options: JsxPluginOptions = {
  include: /\.tsx$/,
  exclude: ["**/*.test.tsx"],
  jsx: { generate: "universal", moduleName: "my-renderer", builtIns: [] },
};
const compilerOptions: JsxCompilerOptions = { dev: true, sourceNames: true };
void options;
void compilerOptions;

// @ts-expect-error The plugin sets the filename for each module.
const filename: JsxCompilerOptions = { filename: "App.tsx" };
// @ts-expect-error The plugin requests source maps for Rolldown.
const sourceMap: JsxCompilerOptions = { sourceMap: true };
// @ts-expect-error Compiler options belong under jsx.
const topLevelOption: JsxPluginOptions = { dev: true };
void filename;
void sourceMap;
void topLevelOption;
