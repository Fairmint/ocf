import fs from "fs";
import { readFile } from "fs/promises";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @returns {Promise<{ registry: object, repoRoot: string }>}
 */
export async function loadRegistryIndex(repoRoot = REPO_ROOT) {
  const registryPath = join(repoRoot, "registry.json");
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  return { registry, repoRoot };
}

/**
 * @param {object} registry
 * @param {string} repoRoot
 */
export async function validateRegistryAgainstSchema(registry, repoRoot = REPO_ROOT) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = JSON.parse(
    await readFile(join(repoRoot, "registry.schema.json"), "utf8")
  );
  const validate = ajv.compile(schema);
  const ok = validate(registry);
  return { ok, errors: validate.errors ?? [] };
}

/**
 * @param {object} registry
 * @param {string} repoRoot
 * @returns {{ id: string, fixtureRoot: string }[]}
 */
export function listRegisteredConformanceRoots(registry, repoRoot = REPO_ROOT) {
  const profiles = registry.profiles ?? [];
  return profiles.map((row) => ({
    id: row.id,
    fixtureRoot: join(repoRoot, "conformance-fixtures", row.id),
  }));
}

/**
 * Ensure each registered extension has a conformance fixture tree (when registry is non-empty).
 * @param {object} registry
 * @param {string} repoRoot
 */
export function assertConformanceDirectoriesExist(registry, repoRoot = REPO_ROOT) {
  const missing = [];
  for (const { id, fixtureRoot } of listRegisteredConformanceRoots(
    registry,
    repoRoot
  )) {
    if (!fs.existsSync(join(fixtureRoot, "base"))) {
      missing.push(id);
    }
  }
  return missing;
}