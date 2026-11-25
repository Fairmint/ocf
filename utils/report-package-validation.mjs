#!/usr/bin/env node
/**
 * CLI report: OCF directory validation + extension issue codes (for conformance evidence).
 */
import { readFile } from "fs/promises";
import { resolve } from "path";
import {
  getOcfValidator,
  getOcfFilesFromDir,
  validateOcfDirectory,
} from "./validate.mjs";
import { CURRENT_SCHEMA_ROOT, resolveOcfSchemaBundle } from "./ocf-version.mjs";
import {
  buildOcfObjectIndex,
  validatePackageExtensions,
} from "./validate-extensions.mjs";

const path = resolve(process.argv[2] ?? ".");

const ocfOk = await validateOcfDirectory(path, false, false);

const ocfPaths = await getOcfFilesFromDir(path);
const parsed = {};
for (const p of ocfPaths) {
  parsed[p] = JSON.parse(await readFile(p, "utf8"));
}
const manifest = Object.values(parsed).find(
  (o) => o.file_type === "OCF_MANIFEST_FILE"
);
let extension = { ok: true, issues: [] };
if (manifest) {
  const bundle = resolveOcfSchemaBundle(manifest.ocf_version);
  const schemaRoot =
    bundle.ok && bundle.schemaRoot ? bundle.schemaRoot : CURRENT_SCHEMA_ROOT;
  const ajv = await getOcfValidator(false, false, false, false, schemaRoot);
  extension = await validatePackageExtensions(manifest, path, {
    ajv,
    ocfObjectIndex: buildOcfObjectIndex(parsed),
    mode: process.argv[3] ?? "standard",
    verbose: false,
  });
}

const summary = {
  path,
  ocf_directory_valid: ocfOk,
  extension_ok: extension.ok,
  errors: extension.issues
    .filter((i) => i.level === "error")
    .map((i) => i.code),
  warnings: extension.issues
    .filter((i) => i.level === "warning")
    .map((i) => i.code),
  issues: extension.issues,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(ocfOk && extension.ok ? 0 : 1);
