import fs from "fs";
import { readFile } from "fs/promises";
import { resolve, join, dirname, isAbsolute, normalize } from "path";
import { fileURLToPath } from "url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE_ID_RE =
  /^(ocf(\.[a-z0-9]+(-[a-z0-9]+)*)+|com\.[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+)$/;

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
  const schema = JSON.parse(
    await readFile(join(repoRoot, "registry.schema.json"), "utf8")
  );
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const ok = validate(registry);
  return { ok, errors: validate.errors ?? [] };
}

function assertRepoRelativePath(path, label) {
  const violations = [];
  if (!path || typeof path !== "string") {
    violations.push(`${label}: missing path`);
    return violations;
  }
  if (isAbsolute(path) || path.startsWith("/")) {
    violations.push(`${label}: must not be absolute (${path})`);
  }
  if (path.includes("..")) {
    violations.push(`${label}: must not contain '..' (${path})`);
  }
  const normalized = normalize(path);
  if (normalized.startsWith("..") || normalized.includes(`${join("", "..")}`)) {
    violations.push(`${label}: resolves outside repo (${path})`);
  }
  return violations;
}

/**
 * Registry business rules beyond JSON Schema.
 * @returns {string[]} violation messages (empty if ok)
 */
export function assertRegistryInvariants(registry, repoRoot = REPO_ROOT) {
  const violations = [];
  const profiles = registry.profiles ?? [];
  const seen = new Set();

  for (const row of profiles) {
    const key = `${row.id}@${row.version}`;
    if (seen.has(key)) {
      violations.push(`duplicate registry key (${row.id}, ${row.version})`);
    }
    seen.add(key);

    if (!PROFILE_ID_RE.test(row.id)) {
      violations.push(`id fails naming rules: ${row.id}`);
    }

    if (row.id.startsWith("ocf.") && row.status === "vendor") {
      violations.push(`ocf.* profile must not use status vendor: ${row.id}`);
    }
    if (row.id.startsWith("com.") && row.status === "accepted") {
      violations.push(`com.* extension must not use status accepted: ${row.id}`);
    }

    violations.push(...assertRepoRelativePath(row.schema, `${row.id}.schema`));
    const expectedSchema = `profiles/${row.id}/${row.version}/schema.json`;
    if (row.schema !== expectedSchema) {
      violations.push(
        `${row.id}: schema must be exactly ${expectedSchema}, got ${row.schema}`
      );
    }

    const schemaAbs = join(repoRoot, row.schema);
    if (!fs.existsSync(schemaAbs)) {
      violations.push(`${row.id}: schema file missing on disk (${row.schema})`);
    }

    if (row.spec) {
      violations.push(...assertRepoRelativePath(row.spec, `${row.id}.spec`));
      if (!fs.existsSync(join(repoRoot, row.spec))) {
        violations.push(`${row.id}: spec file missing on disk (${row.spec})`);
      }
    }
  }

  return violations;
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