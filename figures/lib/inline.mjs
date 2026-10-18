// The vendored kit as plain script, to inline into a standalone figure page (the skill's
// scripts/inline-kit.mjs, pointed at figures/kit).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..", "kit");
const strip = (file) => readFileSync(join(KIT, file), "utf8").replace(/^export /gm, "");

export const kitScript = () => strip("iso-kit.mjs");
export const glScript = () => strip("gl.mjs");
export const turnScript = () => strip("turn.mjs");
