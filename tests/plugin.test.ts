import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { SourceMap } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { rolldown } from "rolldown";
import type { InputOptions, Plugin } from "rolldown";

import jsx, { jsx as namedJsx, solid } from "../src/index.js";
import type { JsxPluginOptions } from "../src/index.js";

interface BuildOptions {
  plugin?: Plugin;
  plugins?: Plugin[];
  external?: string[];
  platform?: InputOptions["platform"];
  onLog?: InputOptions["onLog"];
}

async function bundle(input: string, options: BuildOptions = {}) {
  const build = await rolldown({
    input,
    platform: options.platform,
    external: options.external ?? [
      "@solidjs/web",
      "solid-js",
      "react/jsx-runtime",
    ],
    onLog: options.onLog,
    plugins: [...(options.plugins ?? []), options.plugin ?? solid()],
  });

  try {
    const { output } = await build.generate({ format: "esm", sourcemap: true });
    const chunk = output.find((item) => item.type === "chunk");
    if (!chunk || chunk.type !== "chunk")
      throw new Error("No output chunk was generated");
    return { chunk, output };
  } finally {
    await build.close();
  }
}

async function bundleFile(
  name: string,
  source: string,
  options: BuildOptions = {},
) {
  const dir = await mkdtemp(join(tmpdir(), "solid-compiler-plugin-"));
  try {
    const file = join(dir, name);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, source);
    return await bundle(file, options);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function virtualModule(
  id: string,
  source: string,
  moduleType?: "jsx" | "tsx",
): Plugin {
  return {
    name: "virtual-module",
    resolveId(importee) {
      return importee === "virtual-entry" ? id : null;
    },
    load(loadId) {
      return loadId === id ? { code: source, moduleType } : null;
    },
  };
}

function fixture(path: string) {
  return fileURLToPath(new URL(`./fixtures/${path}`, import.meta.url));
}

function moduleUrl(code: string) {
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}

test("factories are synchronous and the default export is jsx", () => {
  expect(jsx).toBe(namedJsx);
  expect(jsx().name).toBe("rolldown-plugin-solid-compiler");
  expect(solid().name).toBe("rolldown-plugin-solid-compiler");
});

test("Solid compiles JSX and TSX with control-flow built-ins", async () => {
  for (const { name, source } of [
    {
      name: "Widget.jsx",
      source: "export const Widget = () => <button>Save</button>;",
    },
    {
      name: "App.tsx",
      source:
        "type Props = { name: string }; export const App = (props: Props) => <For each={[props.name]}>{name => <div>{name}</div>}</For>;",
    },
  ]) {
    const { chunk } = await bundleFile(name, source);
    expect(chunk.code).toContain('from "@solidjs/web"');
    expect(chunk.code).not.toContain("react/jsx-runtime");
    expect(chunk.code).not.toContain("type Props");
    if (name.endsWith(".tsx")) expect(chunk.code).toMatch(/\bFor\b/);
  }
});

test("generic output uses the requested renderer without Solid built-ins", async () => {
  const { chunk } = await bundleFile(
    "Generic.tsx",
    "export const View = () => <For each={[1]}>{item => <item>{item}</item>}</For>;",
    {
      external: ["custom-renderer"],
      plugin: jsx({
        jsx: { generate: "universal", moduleName: "custom-renderer" },
      }),
    },
  );
  expect(chunk.code).toContain('from "custom-renderer"');
  expect(chunk.code).toContain('createElement("item")');
  expect(chunk.code).not.toContain("@solidjs/web");
  expect(chunk.code).not.toMatch(
    /import \{[^}]*\bFor\b[^}]*\} from "custom-renderer"/,
  );
});

test("generic JSX requires a runtime module when a matching file is transformed", async () => {
  await expect(
    bundleFile("Bare.jsx", "export const View = () => <div />;", {
      plugin: jsx(),
    }),
  ).rejects.toMatchObject({
    errors: [
      {
        id: expect.stringContaining("Bare.jsx"),
        pluginCode: "JSX_COMPILER",
        message: expect.stringContaining("moduleName"),
      },
    ],
  });
});

test("compiler options override the Solid preset, including built-in arrays", async () => {
  const { chunk } = await bundleFile(
    "Override.jsx",
    "export const View = () => <For each={[1]}>{item => <world>{item}</world>}</For>;",
    {
      external: ["custom-renderer"],
      plugin: solid({
        jsx: {
          builtIns: [],
          generate: "universal",
          moduleName: "custom-renderer",
        },
      }),
    },
  );
  expect(chunk.code).toContain('from "custom-renderer"');
  expect(chunk.code).toContain('createElement("world")');
  expect(chunk.code).not.toContain("@solidjs/web");
  expect(chunk.code).not.toMatch(
    /import \{[^}]*\bFor\b[^}]*\} from "custom-renderer"/,
  );
});

test("SSR and dynamic modes forward renderer options", async () => {
  const source =
    "export const View = () => <><world>Hello</world><div>Hello</div></>;";
  const ssr = await bundleFile("View.jsx", source, {
    external: ["custom-renderer/server"],
    plugin: jsx({
      jsx: { generate: "ssr", moduleName: "custom-renderer/server" },
    }),
  });
  expect(ssr.chunk.code).toContain('from "custom-renderer/server"');
  expect(ssr.chunk.code).toContain("ssr(");
  const dynamic = await bundleFile("View.jsx", source, {
    external: ["custom-renderer", "@solidjs/web"],
    plugin: jsx({
      jsx: {
        generate: "dynamic",
        moduleName: "custom-renderer",
        renderers: [
          { name: "dom", moduleName: "@solidjs/web", elements: ["div"] },
        ],
      },
    }),
  });
  expect(dynamic.chunk.code).toContain('from "custom-renderer"');
  expect(dynamic.chunk.code).toContain('from "@solidjs/web"');
});

test("default extensions and query-bearing virtual IDs are compiled with source maps", async () => {
  for (const extension of ["jsx", "tsx", "mjsx", "mtsx", "cjsx", "ctsx"]) {
    const source = extension.endsWith("tsx")
      ? "type Props = { label: string }; export const View = (props: Props) => <div>{props.label}</div>;"
      : "export const View = () => <div>Hello</div>;";
    const { chunk } = await bundleFile(`View.${extension}`, source);
    expect(chunk.code).toContain('from "@solidjs/web"');
    expect(chunk.code).not.toContain("type Props");
    expect(
      chunk.map?.sources.some((source) => source.endsWith(`View.${extension}`)),
    ).toBe(true);
  }
  const { chunk, output } = await bundle("virtual-entry", {
    plugins: [
      virtualModule(
        "/virtual/Query.mtsx?solid",
        "type Props = { label: string }; export const Query = (props: Props) => <section>{props.label}</section>;",
      ),
    ],
  });
  expect(chunk.code).toContain('from "@solidjs/web"');
  expect(chunk.code).not.toContain("type Props");
  expect(
    chunk.map?.sources.some((source) => source.endsWith("Query.mtsx?solid")),
  ).toBe(true);
  expect(
    output.some(
      (item) => item.type === "asset" && item.fileName.endsWith(".map"),
    ),
  ).toBe(true);
});

test("source maps point to original positions in query-bearing TSX modules", async () => {
  const source =
    'export function label() {\n  return "unique-value";\n}\nexport const View = () => <div>{label()}</div>;';
  const { chunk } = await bundle("virtual-entry", {
    plugins: [virtualModule("/virtual/Mapped.tsx?query", source)],
  });
  if (!chunk.map) throw new Error("Expected a source map");
  const offset = chunk.code.indexOf('"unique-value"');
  expect(offset).toBeGreaterThanOrEqual(0);
  const lines = chunk.code.slice(0, offset).split("\n");
  const entry = new SourceMap(JSON.parse(chunk.map.toString())).findEntry(
    lines.length - 1,
    lines.at(-1)?.length ?? 0,
  );
  expect(entry).toMatchObject({
    originalSource: expect.stringContaining("Mapped.tsx?query"),
    originalLine: 1,
    originalColumn: 9,
  });
});

test("Rolldown handles JSX and types when requireImportSource skips compilation", async () => {
  const { chunk } = await bundle("virtual-entry", {
    plugins: [
      virtualModule(
        "/virtual/Skipped.mtsx?query",
        "type Props = { name: string }; export const View = (props: Props) => <div>{props.name}</div>;",
      ),
    ],
    plugin: solid({ jsx: { requireImportSource: "solid-js" } }),
  });
  expect(chunk.code).toContain("react/jsx-runtime");
  expect(chunk.code).not.toContain("type Props");
  expect(chunk.code).not.toContain("@solidjs/web");
});

test("include and exclude filters work with regexes, globs, queries, and dependencies", async () => {
  const source = "export const View = () => <div>Hello</div>;";
  const options: JsxPluginOptions = {
    include: ["**/*.solid.jsx", /Dependency\.jsx$/],
    exclude: /Excluded\.solid\.jsx$/,
  };
  const plugin = () => solid(options);
  for (const name of [
    "Included.solid.jsx",
    "node_modules/pkg/Dependency.jsx",
  ]) {
    const { chunk } = await bundleFile(name, source, { plugin: plugin() });
    expect(chunk.code).toContain('from "@solidjs/web"');
  }
  for (const name of ["Other.jsx", "Excluded.solid.jsx"]) {
    const { chunk } = await bundleFile(name, source, { plugin: plugin() });
    expect(chunk.code).toContain("react/jsx-runtime");
  }
  const included = await bundle("virtual-entry", {
    plugins: [virtualModule("/virtual/Included.solid.jsx?loader", source)],
    plugin: plugin(),
  });
  expect(included.chunk.code).toContain('from "@solidjs/web"');
  const excluded = await bundle("virtual-entry", {
    plugins: [
      virtualModule("/virtual/Excluded.solid.jsx?loader", source, "jsx"),
    ],
    plugin: plugin(),
  });
  expect(excluded.chunk.code).toContain("react/jsx-runtime");
});

test("compiler failures retain Rolldown plugin context", async () => {
  await expect(
    bundleFile("Broken.jsx", "export const Broken = () => <div>;"),
  ).rejects.toMatchObject({
    errors: [
      {
        id: expect.stringContaining("Broken.jsx"),
        plugin: "rolldown-plugin-solid-compiler",
        pluginCode: "JSX_COMPILER",
        message: expect.stringContaining("Unexpected token"),
      },
    ],
  });
});

test("unresolved runtime imports remain Rolldown resolution diagnostics", async () => {
  const logs: Array<{ code?: string; message?: string }> = [];
  await bundleFile("Missing.jsx", "export const View = () => <div />;", {
    external: [],
    plugin: jsx({
      jsx: { generate: "universal", moduleName: "missing-renderer" },
    }),
    onLog(_level, log) {
      logs.push({ code: log.code, message: log.message });
    },
  });
  expect(
    logs.some(
      (log) =>
        log.code === "UNRESOLVED_IMPORT" &&
        log.message?.includes("missing-renderer"),
    ),
  ).toBe(true);
  expect(logs.some((log) => log.code === "PLUGIN_ERROR")).toBe(false);
});

test("extracted TSRX CSS is rejected instead of silently discarded", async () => {
  const source =
    "export const App = () => <><style>div { color: red; }</style><div>Hello</div></>;";
  await expect(
    bundle("virtual-entry", {
      plugin: solid({ include: /\.tsrx$/ }),
      plugins: [virtualModule("/virtual/Styled.tsrx", source, "tsx")],
    }),
  ).rejects.toMatchObject({
    errors: [
      {
        pluginCode: "JSX_COMPILER",
        message: expect.stringContaining("TSRX scoped CSS is not supported"),
      },
    ],
  });
});

test("TSRX without scoped CSS can use a custom include filter", async () => {
  const { chunk } = await bundle("virtual-entry", {
    plugin: solid({ include: /\.tsrx$/ }),
    plugins: [
      virtualModule(
        "/virtual/Plain.tsrx",
        "type Props = { name: string }; export const View = (props: Props) => <div>{props.name}</div>;",
      ),
    ],
  });
  expect(chunk.code).toContain('from "@solidjs/web"');
  expect(chunk.code).not.toContain("type Props");
});

test("a multi-file Solid SSR bundle renders and preserves original source maps", async () => {
  const { chunk } = await bundle(fixture("ssr/entry.ts"), {
    external: [],
    platform: "node",
    plugin: solid({ jsx: { generate: "ssr" } }),
  });
  const server: { renderApp(): string } = await import(moduleUrl(chunk.code));
  expect(server.renderApp()).toBe(
    "<main><p>Hello Ada &amp; &lt;friends></p><ul><li>one</li><li>two</li></ul></main>",
  );
  expect(
    chunk.map?.sources.some((source) => source.endsWith("ssr/App.tsx")),
  ).toBe(true);
  expect(
    chunk.map?.sources.some((source) => source.endsWith("ssr/Greeting.tsx")),
  ).toBe(true);
});

test("a Solid DOM bundle mounts and updates a real DOM", async () => {
  const { chunk } = await bundle(fixture("client.tsx"), {
    external: [],
    platform: "browser",
  });
  const window = new Window();
  const names = ["window", "document", "Node", "Element"];
  const previous = new Map(
    names.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  Object.assign(globalThis, {
    window,
    document: window.document,
    Node: window.Node,
    Element: window.Element,
  });
  try {
    const client: { mount(root: unknown): () => void } = await import(
      moduleUrl(chunk.code)
    );
    const dispose = client.mount(window.document.body);
    const button = window.document.querySelector("button");
    expect(button?.textContent).toBe("Count: 0");
    button?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(button?.textContent).toBe("Count: 1");
    dispose();
    expect(window.document.body.textContent).toBe("");
  } finally {
    for (const name of names) {
      const descriptor = previous.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
    await window.happyDOM.close();
  }
});
