import type { TransformOptions } from "@solidjs/compiler";

export type FilterPattern = string | RegExp | readonly (string | RegExp)[];

export type JsxCompilerOptions = Omit<
  TransformOptions,
  "filename" | "sourceMap"
>;

export interface JsxPluginOptions {
  /** Rolldown module IDs to transform. Replaces the default JSX/TSX filter. */
  include?: FilterPattern;

  /** Rolldown module IDs to skip. */
  exclude?: FilterPattern;

  /** Options passed to the native Solid compiler. */
  jsx?: JsxCompilerOptions;
}
