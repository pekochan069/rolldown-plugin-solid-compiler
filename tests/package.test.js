import { expect, test } from "bun:test";
import jsx, { jsx as namedJsx, solid } from "rolldown-plugin-solid-compiler";

test("the built package exposes both factories", () => {
  expect(jsx).toBe(namedJsx);
  expect(solid().name).toBe("rolldown-plugin-solid-compiler");
});
