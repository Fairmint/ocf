#!/usr/bin/env node
/**
 * Run ocf.stock-hold conformance fixtures against the draft extension registry.
 * Execute from the Fairmint/ocf repository root: node extensions-registry-draft/scripts/run-conformance-fixtures.mjs
 */
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const result = spawnSync(
  "npm",
  [
    "test",
    "--",
    "--testPathPattern=extensions-registry-draft-conformance",
    "--no-cache",
  ],
  { cwd: repoRoot, stdio: "inherit", shell: true }
);
process.exit(result.status ?? 1);
