#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import { cpSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pin = JSON.parse(
  fs.readFileSync(join(REPO_ROOT, "vendor/ocf-schema-pin.json"), "utf8")
);
const dest = join(REPO_ROOT, "vendor/ocf-schema");
const schemaMarker = join(dest, "schema", "files", "OCFManifestFile.schema.json");

function run(cmd, cwd = REPO_ROOT) {
  execSync(cmd, { cwd, stdio: "inherit" });
}

function overlayTree() {
  const overlayRoot = join(REPO_ROOT, pin.overlayPath);
  const overlaySchema = join(overlayRoot, "schema");
  if (fs.existsSync(overlaySchema)) {
    cpSync(overlaySchema, join(dest, "schema"), { recursive: true, force: true });
  }
}

if (fs.existsSync(schemaMarker)) {
  overlayTree();
  console.log(`Using existing OCF schema at ${dest}`);
  process.exit(0);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(join(REPO_ROOT, "vendor"), { recursive: true });
run(`git clone --depth 1 ${pin.repository} ${dest}`);
run(`git fetch --depth 1 origin ${pin.ref}`, dest);
run(`git checkout ${pin.ref}`, dest);
overlayTree();
console.log(`Fetched OCF schema ${pin.ref} (${pin.refLabel}) into vendor/ocf-schema`);