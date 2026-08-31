import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const program = JSON.parse(readFileSync(join(root, "data/program.json"), "utf8"));
const weights = JSON.parse(readFileSync(join(root, "data/weights.json"), "utf8"));

const c = program.days.C;
const h1 = c.exercises.find((e) => e.id === "hammer1");
const h2 = c.exercises.find((e) => e.id === "hammer2");
if (!h1 || h1.clusterPair !== "hammer2" || h1.restSec !== 0) {
  throw new Error("hammer1 must pair to hammer2 with rest 0");
}
if (!h2 || !h2.clusterAfterPair || h2.restSec !== 120) {
  throw new Error("hammer2 must rest 120 after pair");
}
for (const id of Object.keys(weights)) {
  if (typeof weights[id] !== "number") throw new Error(`bad weight ${id}`);
}
console.log("program.json ok: cluster C, weights", Object.keys(weights).length);
