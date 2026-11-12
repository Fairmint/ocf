import fs from "fs";
import { readFile, readdir } from "fs/promises";
import { normalize, resolve, join } from "path";
import {
  DRAFT_07_META,
  EXTENSION_ERROR_CODES as C,
} from "./extension-error-codes.mjs";
import { verifyManifestFileDigests } from "./package-digest-verify.mjs";
import {
  compareOcfSemverCore,
  resolveOcfSchemaBundle,
} from "./ocf-version.mjs";
import { validateSecurityLegendProfileSemantics } from "./validate-profile-security-legend.mjs";

const REGISTRY_PATH = "./OCIP/registry/profiles.json";

const ECONOMIC_FIELD_NAMES = new Set([
  "quantity",
  "resulting_security_ids",
  "security_id",
  "balance_security_id",
  "amount",
  "shares_issued",
]);

/**
 * @typedef {"lenient" | "standard" | "strict"} ValidationMode
 * @typedef {{ level: "error" | "warning", code: string, message: string }} ExtensionIssue
 */

function parseSemverCore(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareSemver(a, b) {
  const av = parseSemverCore(a);
  const bv = parseSemverCore(b);
  if (!av || !bv) {
    return NaN;
  }
  if (av.major !== bv.major) {
    return av.major - bv.major;
  }
  if (av.minor !== bv.minor) {
    return av.minor - bv.minor;
  }
  return av.patch - bv.patch;
}

function versionSatisfiesRange(version, range) {
  const core = parseSemverCore(version);
  if (!core) {
    return false;
  }
  const gte = range.match(/>=\s*(\d+\.\d+\.\d+)/);
  const lt = range.match(/<\s*(\d+\.\d+\.\d+)/);
  if (gte && compareSemver(version, gte[1]) < 0) {
    return false;
  }
  if (lt && compareSemver(version, lt[1]) >= 0) {
    return false;
  }
  if (!gte && !lt && range.trim() === version.trim()) {
    return true;
  }
  return Boolean(gte || lt);
}

function normalizePackagePath(packageRoot, filepath) {
  const withoutDot = filepath.replace(/^\.\//, "");
  return normalize(resolve(packageRoot, withoutDot));
}

function loadRegistry() {
  const raw = fs.readFileSync(REGISTRY_PATH, "utf8");
  return JSON.parse(raw);
}

function findRegistryEntry(registry, id, version) {
  return registry.profiles.find(
    (row) => row.id === id && row.version === version
  );
}

function bestKnownRegistryVersion(registry, id, manifestVersion) {
  const manifestCore = parseSemverCore(manifestVersion);
  if (!manifestCore) {
    return null;
  }
  const candidates = registry.profiles
    .filter((row) => row.id === id)
    .map((row) => row.version)
    .sort((a, b) => compareSemver(b, a));
  for (const candidate of candidates) {
    const candidateCore = parseSemverCore(candidate);
    if (!candidateCore) {
      continue;
    }
    if (
      candidateCore.major === manifestCore.major &&
      compareSemver(candidate, manifestVersion) <= 0
    ) {
      return candidate;
    }
  }
  return null;
}

export function assertProfileSchemaDraft07(profileSchema) {
  const schemaUri = profileSchema.$schema;
  if (schemaUri !== DRAFT_07_META) {
    throw new Error(
      `Profile schema must declare "$schema": "${DRAFT_07_META}" (got ${JSON.stringify(
        schemaUri
      )}). A future JSON Schema draft would be a profile MAJOR bump.`
    );
  }
}

export function compileProfileSchema(ajv, profileSchema) {
  assertProfileSchemaDraft07(profileSchema);
  ajv.addSchema(profileSchema, profileSchema.$id);
  return ajv.getSchema(profileSchema.$id);
}

/**
 * @param {object} ocfFiles — map of relative or absolute paths to parsed JSON
 */
export function buildOcfObjectIndex(ocfFiles) {
  const index = new Set();
  for (const obj of Object.values(ocfFiles)) {
    if (obj?.file_type === "OCF_MANIFEST_FILE" && obj.issuer?.id) {
      index.add(`ISSUER:${obj.issuer.id}`);
    }
    if (Array.isArray(obj?.items)) {
      for (const item of obj.items) {
        if (item?.id && item?.object_type) {
          index.add(`${item.object_type}:${item.id}`);
        }
      }
    }
  }
  return index;
}

function walkObjectReferences(node, refs = []) {
  if (!node || typeof node !== "object") {
    return refs;
  }
  if (
    typeof node.object_type === "string" &&
    typeof node.object_id === "string"
  ) {
    refs.push({ object_type: node.object_type, object_id: node.object_id });
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      walkObjectReferences(child, refs);
    }
  } else {
    for (const value of Object.values(node)) {
      walkObjectReferences(value, refs);
    }
  }
  return refs;
}

function collectOcfTransactionItems(ocfParsedByPath = {}) {
  const items = [];
  for (const obj of Object.values(ocfParsedByPath)) {
    if (
      obj?.file_type === "OCF_TRANSACTIONS_FILE" &&
      Array.isArray(obj.items)
    ) {
      items.push(...obj.items);
    }
  }
  return items;
}

function collectLegendTemplateIds(ocfObjectIndex) {
  const ids = new Set();
  for (const key of ocfObjectIndex) {
    if (key.startsWith("STOCK_LEGEND_TEMPLATE:")) {
      ids.add(key.slice("STOCK_LEGEND_TEMPLATE:".length));
    }
  }
  return ids;
}

function findEconomicFieldViolations(node, path = "", hits = []) {
  if (!node || typeof node !== "object") {
    return hits;
  }
  if (Array.isArray(node)) {
    node.forEach((child, i) =>
      findEconomicFieldViolations(child, `${path}[${i}]`, hits)
    );
    return hits;
  }
  for (const [key, value] of Object.entries(node)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (ECONOMIC_FIELD_NAMES.has(key) && key !== "object_id") {
      hits.push(nextPath);
    } else if (typeof value === "object") {
      findEconomicFieldViolations(value, nextPath, hits);
    }
  }
  return hits;
}

function relaxAdditionalProperties(node) {
  if (!node || typeof node !== "object") {
    return;
  }
  if (node.type === "object" && node.additionalProperties === false) {
    node.additionalProperties = true;
  }
  for (const value of Object.values(node)) {
    if (typeof value === "object") {
      relaxAdditionalProperties(value);
    }
  }
}

async function listUndeclaredProfileFiles(packageRoot, declaredPaths) {
  const profilesRoot = resolve(packageRoot, "profiles");
  if (!fs.existsSync(profilesRoot)) {
    return [];
  }
  const declared = new Set(
    declaredPaths.map((p) => p.replace(/^\.\//, "").replace(/\\/g, "/"))
  );
  const found = [];
  async function walk(dir, rel = "") {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const relPath = rel ? `${rel}/${ent.name}` : ent.name;
      const abs = join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(abs, relPath);
      } else if (ent.name.endsWith(".json") && !ent.name.includes("schema")) {
        const normalized = `profiles/${relPath}`.replace(/\\/g, "/");
        if (!declared.has(normalized)) {
          found.push(normalized);
        }
      }
    }
  }
  await walk(profilesRoot);
  return found;
}

/**
 * @param {object} manifest
 * @param {string} packageRoot
 * @param {{ mode?: ValidationMode, verbose?: boolean, ajv?: import('ajv').default, ocfObjectIndex?: Set<string>, ocfParsedByPath?: Record<string, object> }} options
 */
export async function validatePackageExtensions(
  manifest,
  packageRoot,
  options = {}
) {
  const {
    mode = "standard",
    verbose = false,
    ajv: sharedAjv,
    ocfObjectIndex = new Set(),
    ocfParsedByPath = {},
  } = options;

  const ocfTransactions = collectOcfTransactionItems(ocfParsedByPath);
  const legendTemplateIds = collectLegendTemplateIds(ocfObjectIndex);

  /** @type {ExtensionIssue[]} */
  const issues = [];
  const digestResult = verifyManifestFileDigests(manifest, packageRoot);
  issues.push(...digestResult.issues);
  if (verbose && digestResult.issues.length > 0) {
    for (const issue of digestResult.issues) {
      console.log(`\t[${issue.level}] ${issue.code}: ${issue.message}`);
    }
  }

  const registry = loadRegistry();

  const profiles = manifest.profiles ?? [];
  const vendorExtensions = manifest.vendor_extensions ?? [];
  const profileFiles = manifest.profile_files ?? [];
  const vendorFiles = manifest.vendor_extension_files ?? [];

  const declaredProfileIds = new Set(profiles.map((p) => p.id));
  const declaredVendorIds = new Set(vendorExtensions.map((p) => p.id));

  /**
   * @param {"error" | "warning"} level
   * @param {string} code
   * @param {string} message
   */
  const push = (level, code, message) => {
    issues.push({ level, code, message });
    if (verbose) {
      console.log(`\t[${level}] ${code}: ${message}`);
    }
  };

  const bundle = resolveOcfSchemaBundle(manifest.ocf_version);
  if (!bundle.ok) {
    push("error", C.OCF_VERSION_UNSUPPORTED, bundle.message);
    const errors = issues.filter((i) => i.level === "error");
    return { ok: errors.length === 0, issues };
  }
  if (verbose && bundle.loadFromRelease) {
    console.log(`\t${bundle.message}`);
  }

  const manifestIds = new Map();
  for (const decl of profiles) {
    if (manifestIds.has(decl.id)) {
      push(
        "error",
        C.PROFILE_NAMESPACE_VIOLATION,
        `Duplicate profile id in manifest: ${decl.id}`
      );
    }
    manifestIds.set(decl.id, decl.version);
    if (!decl.id.startsWith("ocf.")) {
      const level = mode === "lenient" ? "warning" : "error";
      push(
        level,
        C.PROFILE_NAMESPACE_VIOLATION,
        `Profile id must start with ocf.: ${decl.id}`
      );
    }
  }
  for (const decl of vendorExtensions) {
    if (manifestIds.has(decl.id)) {
      push(
        "error",
        C.PROFILE_NAMESPACE_VIOLATION,
        `Duplicate vendor extension id in manifest: ${decl.id}`
      );
    }
    manifestIds.set(decl.id, decl.version);
    if (!decl.id.startsWith("com.")) {
      const level = mode === "lenient" ? "warning" : "error";
      push(
        level,
        C.PROFILE_NAMESPACE_VIOLATION,
        `Vendor extension id must start with com.: ${decl.id}`
      );
    }
  }

  const resolveRegistryRow = (decl) => {
    const row = findRegistryEntry(registry, decl.id, decl.version);
    if (row) {
      return row;
    }
    const fallbackVersion = bestKnownRegistryVersion(
      registry,
      decl.id,
      decl.version
    );
    return fallbackVersion
      ? findRegistryEntry(registry, decl.id, fallbackVersion)
      : null;
  };

  for (const decl of profiles) {
    const exact = findRegistryEntry(registry, decl.id, decl.version);
    if (!exact) {
      const known = bestKnownRegistryVersion(registry, decl.id, decl.version);
      const manifestCore = parseSemverCore(decl.version);
      const knownCore = known ? parseSemverCore(known) : null;
      if (
        known &&
        manifestCore &&
        knownCore &&
        manifestCore.major === knownCore.major &&
        compareSemver(decl.version, known) > 0
      ) {
        push(
          "warning",
          C.PROFILE_NEWER_MINOR,
          `Profile ${decl.id} manifest version ${decl.version} is newer than registry ${known}; validate against ${known} and tolerate unknown optional fields`
        );
      } else if (
        manifestCore &&
        knownCore &&
        manifestCore.major > knownCore.major
      ) {
        const level = mode === "strict" ? "error" : "warning";
        push(
          level,
          C.PROFILE_NEWER_MAJOR,
          `Profile ${decl.id} major version ${decl.version} is newer than any known implementation (treat as unknown profile)`
        );
      } else {
        const level = mode === "strict" ? "error" : "warning";
        push(
          level,
          C.UNKNOWN_COALITION_PROFILE,
          `Unknown coalition profile in manifest: ${decl.id} ${decl.version}`
        );
      }
    } else if (exact.status && exact.status !== "accepted") {
      if (exact.status === "rejected" && mode === "strict") {
        push(
          "error",
          C.PROFILE_STATUS_NOT_ACCEPTED,
          `Profile ${decl.id} ${decl.version} has registry status rejected`
        );
      } else {
        push(
          "warning",
          C.PROFILE_STATUS_NOT_ACCEPTED,
          `Profile ${decl.id} ${decl.version} has registry status ${exact.status}`
        );
      }
    }

    const registryRow = resolveRegistryRow(decl);
    if (registryRow?.min_ocf_version) {
      if (
        compareOcfSemverCore(
          manifest.ocf_version,
          registryRow.min_ocf_version
        ) < 0
      ) {
        push(
          "error",
          C.PROFILE_OCF_VERSION_UNSUPPORTED,
          `Profile ${decl.id} requires OCF schema ${registryRow.min_ocf_version} but package declares ${manifest.ocf_version}`
        );
      }
    }
  }

  for (const decl of profiles) {
    let entryForDeps = resolveRegistryRow(decl);
    if (!entryForDeps) {
      const fallbackVersion = bestKnownRegistryVersion(
        registry,
        decl.id,
        decl.version
      );
      if (fallbackVersion) {
        entryForDeps = findRegistryEntry(registry, decl.id, fallbackVersion);
      }
    }
    const requirements = entryForDeps?.requires_profiles ?? [];
    for (const dep of requirements) {
      const manifestDecl = profiles.find((p) => p.id === dep.id);
      if (!manifestDecl) {
        push(
          "error",
          C.PROFILE_UNMET_DEPENDENCY,
          `Profile ${decl.id} requires ${dep.id} ${dep.version} but it is not declared in manifest profiles`
        );
        continue;
      }
      if (!versionSatisfiesRange(manifestDecl.version, dep.version)) {
        push(
          "error",
          C.PROFILE_UNMET_DEPENDENCY,
          `Profile ${decl.id} requires ${dep.id} ${dep.version}; manifest declares ${manifestDecl.version}`
        );
      }
    }
  }

  const filesForProfile = new Map();
  for (const file of profileFiles) {
    const rel = file.filepath.replace(/^\.\//, "").replace(/\\/g, "/");
    const match = rel.match(/^profiles\/([^/]+)\//);
    if (!match) {
      push(
        "error",
        C.PROFILE_FILE_WITHOUT_DECLARATION,
        `Profile file not under profiles/<id>/: ${file.filepath}`
      );
      continue;
    }
    const owner = match[1];
    if (!declaredProfileIds.has(owner)) {
      push(
        "error",
        C.PROFILE_FILE_WITHOUT_DECLARATION,
        `Profile file ${file.filepath} declared but profile id ${owner} is not in manifest profiles`
      );
    }
    if (!filesForProfile.has(owner)) {
      filesForProfile.set(owner, []);
    }
    filesForProfile.get(owner).push(file);
    if (rel.includes("..")) {
      push(
        "error",
        C.PROFILE_FILE_WITHOUT_DECLARATION,
        `Profile filepath must be normalized (no ..): ${file.filepath}`
      );
    }
  }

  const filesForVendor = new Map();
  for (const file of vendorFiles) {
    const rel = file.filepath.replace(/^\.\//, "").replace(/\\/g, "/");
    const match = rel.match(/^vendor\/([^/]+)\//);
    if (!match) {
      push(
        "error",
        C.PROFILE_FILE_WITHOUT_DECLARATION,
        `Vendor file not under vendor/<id>/: ${file.filepath}`
      );
      continue;
    }
    const owner = match[1];
    if (!declaredVendorIds.has(owner)) {
      push(
        "error",
        C.PROFILE_FILE_WITHOUT_DECLARATION,
        `Vendor file ${file.filepath} declared but extension id ${owner} is not in manifest vendor_extensions`
      );
    }
    if (!filesForVendor.has(owner)) {
      filesForVendor.set(owner, []);
    }
    filesForVendor.get(owner).push(file);
  }

  for (const id of declaredProfileIds) {
    if (!filesForProfile.has(id) || filesForProfile.get(id).length === 0) {
      push(
        "error",
        C.PROFILE_DECLARED_NO_FILES,
        `Declared profile ${id} has no entries in profile_files`
      );
    }
  }
  for (const id of declaredVendorIds) {
    if (!filesForVendor.has(id) || filesForVendor.get(id).length === 0) {
      push(
        "error",
        C.PROFILE_DECLARED_NO_FILES,
        `Declared vendor extension ${id} has no entries in vendor_extension_files`
      );
    }
  }

  const undeclaredOnDisk = await listUndeclaredProfileFiles(
    packageRoot,
    profileFiles.map((f) => f.filepath)
  );
  for (const path of undeclaredOnDisk) {
    push(
      "error",
      C.PROFILE_FILE_UNDECLARED,
      `Profile payload on disk is not listed in profile_files: ${path}`
    );
  }

  if (!sharedAjv) {
    push(
      "error",
      C.PROFILE_SCHEMA_INVALID,
      "Internal error: OCF AJV validator required for profile schema validation"
    );
    return { ok: false, issues };
  }

  for (const decl of profiles) {
    let schemaVersion = decl.version;
    let entry = findRegistryEntry(registry, decl.id, decl.version);
    if (!entry) {
      const fallback = bestKnownRegistryVersion(
        registry,
        decl.id,
        decl.version
      );
      if (fallback) {
        schemaVersion = fallback;
        entry = findRegistryEntry(registry, decl.id, fallback);
      }
    }
    if (!entry?.schema) {
      continue;
    }

    const schemaPath = entry.schema.startsWith("/")
      ? entry.schema.slice(1)
      : entry.schema;
    const profileSchema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

    let validate;
    try {
      validate = compileProfileSchema(sharedAjv, profileSchema);
    } catch (e) {
      push("error", C.PROFILE_SCHEMA_DRAFT_MISMATCH, e.message);
      continue;
    }

    const tolerateNewerMinor =
      schemaVersion !== decl.version &&
      parseSemverCore(decl.version)?.major ===
        parseSemverCore(schemaVersion)?.major;

    const files = filesForProfile.get(decl.id) ?? [];
    for (const file of files) {
      const absPath = normalizePackagePath(packageRoot, file.filepath);
      if (!fs.existsSync(absPath)) {
        push(
          "error",
          C.PROFILE_SCHEMA_INVALID,
          `Profile file missing on disk: ${file.filepath}`
        );
        continue;
      }
      const payload = JSON.parse(await readFile(absPath, "utf8"));

      const economicHits = findEconomicFieldViolations(payload);
      for (const hit of economicHits) {
        if (
          decl.id === "ocf.security-legend" &&
          (/^security_legend_assignments(\[\d+\])?\.security_id$/.test(hit) ||
            /^security_legend_assignments(\[\d+\])?\.legend_ids/.test(hit))
        ) {
          continue;
        }
        push(
          "warning",
          C.PROFILE_ECONOMIC_VIOLATION,
          `Profile ${decl.id} file ${file.filepath} may contain cap-table field at ${hit} (advisory; see §5)`
        );
      }

      if (decl.id === "ocf.security-legend") {
        validateSecurityLegendProfileSemantics(
          payload,
          ocfTransactions,
          legendTemplateIds,
          push
        );
      }

      const refs = walkObjectReferences(payload);
      for (const ref of refs) {
        const key = `${ref.object_type}:${ref.object_id}`;
        if (!ocfObjectIndex.has(key)) {
          push(
            "error",
            C.PROFILE_DANGLING_REFERENCE,
            `Profile ${decl.id} reference ${key} not found in OCF schema files`
          );
        }
      }

      let valid = validate(payload);
      if (!valid && tolerateNewerMinor) {
        const relaxed = JSON.parse(JSON.stringify(profileSchema));
        relaxed.$id = `${profileSchema.$id}?tolerant=${schemaVersion}`;
        relaxAdditionalProperties(relaxed);
        const permissiveValidate = compileProfileSchema(sharedAjv, relaxed);
        valid = permissiveValidate(payload);
      }
      if (!valid) {
        push(
          "error",
          C.PROFILE_SCHEMA_INVALID,
          `Profile ${decl.id} file ${file.filepath} invalid: ${JSON.stringify(
            validate.errors
          )}`
        );
      } else if (verbose) {
        console.log(`\tValidated profile ${decl.id} @ ${file.filepath}`);
      }
    }
  }

  const errors = issues.filter((i) => i.level === "error");
  return { ok: errors.length === 0, issues };
}
