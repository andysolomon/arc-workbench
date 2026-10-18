// The figures run the Workbench's own code: `truth(entry)` bundles a TypeScript entry that
// re-exports from src/ (the queueing engine, the presets) into one IIFE that sets `globalThis.WB`.
// The build evaluates that same string to read the preset, and the page inlines it, so the numbers
// a figure shows and the numbers the Workbench simulates can't drift apart.
import { runInNewContext } from "node:vm";
import { build } from "vite";

export async function truth(entry) {
  const out = await build({
    configFile: false,
    logLevel: "silent",
    build: { write: false, minify: false, emptyOutDir: false, lib: { entry, formats: ["iife"], name: "WB", fileName: () => "truth.js" } },
  });
  const chunk = [out].flat()[0].output.find((file) => file.type === "chunk");
  const code = `${chunk.code}\nglobalThis.WB = WB;\n`;
  // a fresh context has every ECMAScript built-in; add the few host APIs the bundles may touch
  const scope = { console, TextEncoder, TextDecoder, atob, btoa };
  scope.globalThis = scope;
  runInNewContext(code, scope);
  return { code, WB: scope.WB };
}
