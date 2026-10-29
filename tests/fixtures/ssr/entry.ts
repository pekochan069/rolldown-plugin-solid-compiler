import { renderToString } from "@solidjs/web";
import { App } from "./App";

export function renderApp() {
  return renderToString(() => App({ name: "Ada & <friends>" }));
}
