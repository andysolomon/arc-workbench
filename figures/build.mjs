// Builds every Anatomy figure, dark and light, into public/figures/ for the System designs page.
//   node figures/build.mjs              build all
//   node figures/build.mjs --if-stale   skip when no figure source, kit file or src/ module changed
// A figure is a folder with a build.mjs that takes --light and --out=<dir> (figures/load-balanced/).
import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(ROOT, "public", "figures");
const FIGURES = readdirSync(HERE).filter((name) => existsSync(join(HERE, name, "build.mjs")));

const newest = (dir) => {
  let t = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const s = statSync(path);
    t = Math.max(t, s.isDirectory() ? newest(path) : s.mtimeMs);
  }
  return t;
};
const outputsOf = (name) => [`${name}.html`, `${name}-light.html`].map((file) => join(OUT, file));

mkdirSync(OUT, { recursive: true });
const stale = process.argv.includes("--if-stale");
const inputs = Math.max(newest(join(HERE, "kit")), newest(join(HERE, "lib")), newest(join(ROOT, "src", "sim")), newest(join(ROOT, "src", "paradigms")));
const jobs = [];
for (const name of FIGURES) {
  const outputs = outputsOf(name);
  const built = Math.min(...outputs.map((file) => (existsSync(file) ? statSync(file).mtimeMs : 0)));
  if (stale && built > Math.max(inputs, newest(join(HERE, name)))) {
    console.log(`figures: ${name} is up to date`);
    continue;
  }
  for (const theme of [[], ["--light"]]) jobs.push([join(HERE, name, "build.mjs"), ...theme, `--out=${OUT}`]);
}

// every page is an independent, CPU-bound build: run them a core at a time
const run = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`figures: ${args.slice(0, -1).join(" ")} exited with ${code}`))));
  });
let failed = null;
const worker = async () => {
  while (jobs.length && !failed) await run(jobs.shift()).catch((error) => (failed = error));
};
await Promise.all(Array.from({ length: Math.min(availableParallelism(), jobs.length) }, worker));
if (failed) {
  console.error(failed.message);
  process.exit(1);
}
