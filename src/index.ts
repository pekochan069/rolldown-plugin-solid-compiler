import { transformAsync } from "@solidjs/compiler";
import type { Plugin } from "rolldown";
import { makeIdFiltersToMatchWithQuery } from "rolldown/filter";

import { pluginName, solidPreset } from "./constants.js";
import type { JsxCompilerOptions, JsxPluginOptions } from "./options.js";

export type { JsxCompilerOptions, JsxPluginOptions } from "./options.js";

const defaultInclude = /\.[cm]?[jt]sx$/i;

function compilerFilename(id: string): string {
  return id
    .replace(/[?#].*$/, "")
    .replace(/\.[cm]jsx$/i, ".jsx")
    .replace(/\.[cm]tsx$/i, ".tsx");
}

function outputModuleType(filename: string): "jsx" | "tsx" | undefined {
  if (/\.(?:tsx|tsrx)$/i.test(filename)) return "tsx";
  if (/\.jsx$/i.test(filename)) return "jsx";
}

function createPlugin(
  options: JsxPluginOptions,
  preset: JsxCompilerOptions,
  requiresModuleName: boolean,
): Plugin {
  const idFilter = {
    include: makeIdFiltersToMatchWithQuery(options.include ?? defaultInclude),
    exclude:
      options.exclude === undefined
        ? undefined
        : makeIdFiltersToMatchWithQuery(options.exclude),
  };

  return {
    name: pluginName,
    transform: {
      filter: { id: idFilter },
      async handler(code, id) {
        try {
          if (requiresModuleName && options.jsx?.moduleName === undefined) {
            throw new Error("jsx() requires a `moduleName` option under `jsx`");
          }

          const filename = compilerFilename(id);
          const result = await transformAsync(code, {
            ...preset,
            ...options.jsx,
            filename,
            sourceMap: true,
          });

          if (result.css) {
            throw new Error("TSRX scoped CSS is not supported by this plugin");
          }

          return {
            code: result.code,
            map: result.map,
            moduleType: outputModuleType(filename),
          };
        } catch (error: unknown) {
          this.error({
            id,
            message: `[${pluginName}] ${error instanceof Error ? error.message : String(error)}`,
            pluginCode: "JSX_COMPILER",
          });
        }
      },
    },
  };
}

/** Create a renderer-agnostic JSX transform. Supply a runtime module in `jsx.moduleName`. */
export function jsx(options: JsxPluginOptions = {}): Plugin {
  return createPlugin(options, { builtIns: [] }, true);
}

/** Create a JSX transform with the Solid 2 web defaults. */
export function solid(options: JsxPluginOptions = {}): Plugin {
  return createPlugin(options, solidPreset, false);
}

export default jsx;
