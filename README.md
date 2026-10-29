# rolldown-plugin-solid-compiler

A Rolldown plugin that transforms JSX and TSX with Solid 2's native
[`@solidjs/compiler`](https://github.com/solidjs/solid/tree/main/packages/compiler).

## Installation

```sh
npm install -D rolldown rolldown-plugin-solid-compiler
```

The plugin requires Rolldown version greater than 1.0.0.

## Usage

Use `solid()` for the Solid web runtime:

```ts
import { defineConfig } from "rolldown";
import { solid } from "rolldown-plugin-solid-compiler";

export default defineConfig({
  input: "src/App.tsx",
  plugins: [solid()],
  output: { file: "dist/app.js", format: "esm", sourcemap: true },
});
```

Pass compiler options under `jsx`, for example for server rendering:

```ts
solid({ jsx: { generate: "ssr", hydratable: true } });
```

For a custom renderer, use the default export (also available as named `jsx`)
and specify its runtime module:

```ts
import jsx from "rolldown-plugin-solid-compiler";

jsx({ jsx: { generate: "universal", moduleName: "my-renderer" } });
```

The `jsx()` factory is renderer-agnostic: it requires `jsx.moduleName` when a
module is transformed and defaults to an empty `builtIns` list. This preserves
the original plugin's behavior even though the Solid compiler itself defaults
to `@solidjs/web` and Solid's built-ins. Set `builtIns` explicitly if your
renderer needs them.

## Options

Both factories accept `JsxPluginOptions`:

```ts
interface JsxPluginOptions {
  include?: string | RegExp | readonly (string | RegExp)[];
  exclude?: string | RegExp | readonly (string | RegExp)[];
  jsx?: JsxCompilerOptions;
}
```

- `include` replaces the default `/\.[cm]?[jt]sx$/i` filter, which matches
  JSX, TSX, and their `m`/`c` variants. String patterns use Rolldown's glob
  semantics. Filters also match IDs with query strings.
- `exclude` skips matching IDs. There is no default exclusion, including for
  `node_modules`.
- `jsx` accepts `@solidjs/compiler`'s `TransformOptions` except `filename` and
  `sourceMap`, which the plugin supplies. User options shallowly override the
  preset; arrays such as `builtIns` replace the preset array.

`solid()` uses `@solidjs/web`, the Solid 2 built-ins, DOM output, custom-element
context, and conditional wrapping by default. See the
[compiler options](https://github.com/solidjs/solid/tree/main/packages/compiler#options)
for supported generation modes and settings. The plugin returns source maps to
Rolldown; enable `output.sourcemap` to emit them.

The plugin handles the JSX transform only. It does not provide a dev server,
HMR, server-function directive transforms, or other framework integration.
It does not emit the scoped CSS extracted by the compiler's experimental TSRX
frontend: if a custom filter or `syntax` option enables TSRX and scoped CSS is
returned, the build fails with an error instead of dropping the CSS.

## Development

```sh
bun install
bun run typecheck
bun run test
bun run build
```
