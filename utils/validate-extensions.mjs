import Ajv from "ajv";
import addFormats from "ajv-formats";
import fs from "fs";
import { readFile } from "fs/promises";
import { normalize, resolve } from "path";

const REGISTRY_PATH = "./OCIP/registry/profiles.json";
const OBJECT_REFERENCE_SCHEMA_ID =
  "https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/ObjectReference.schema.json";

/**
 * @typedef {"lenient" | "standard" | "strict"} ValidationMode
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

/**
 * @param {object} manifest
 * @param {string} packageRoot
 * @param {ValidationMode} mode
 * @param {boolean} verbose
 */
export async function validatePackageExtensions(
  manifest,
  packageRoot,
  mode = "standard",
  verbose = false
) {
  const issues = [];
  const registry = loadRegistry();

  const profiles = manifest.profiles ?? [];
  const vendorExtensions = manifest.vendor_extensions ?? [];
  const profileFiles = manifest.profile_files ?? [];
  const vendorFiles = manifest.vendor_extension_files ?? [];

  const declaredProfileIds = new Set(profiles.map((p) => p.id));
  const declaredVendorIds = new Set(vendorExtensions.map((p) => p.id));

  const push = (level, message) => {
    issues.push({ level, message });
    if (verbose) {
      console.log(`\t[${level}] ${message}`);
    }
  };

  const manifestIds = new Map();
  for (const decl of profiles) {
    if (manifestIds.has(decl.id)) {
      push("error", `Duplicate profile id in manifest: ${decl.id}`);
    }
    manifestIds.set(decl.id, decl.version);
    if (!decl.id.startsWith("ocf.")) {
      const level = mode === "lenient" ? "warning" : "error";
      push(level, `Profile id must start with ocf.: ${decl.id}`);
    }
  }
  for (const decl of vendorExtensions) {
    if (manifestIds.has(decl.id)) {
      push("error", `Duplicate vendor extension id in manifest: ${decl.id}`);
    }
    manifestIds.set(decl.id, decl.version);
    if (!decl.id.startsWith("com.")) {
      const level = mode === "lenient" ? "warning" : "error";
      push(level, `Vendor extension id must start with com.: ${decl.id}`);
    }
  }

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
        if (mode === "strict") {
          push(
            "warning",
            `Profile ${decl.id} manifest version ${decl.version} is newer than registry ${known}; validate against ${known} and tolerate unknown optional fields`
          );
        } else if (mode === "standard") {
          push(
            "warning",
            `Profile ${decl.id} manifest version ${decl.version} is newer than registry ${known}; validate against ${known} and tolerate unknown optional fields`
          );
        } else {
          push(
            "warning",
            `Profile ${decl.id} version ${decl.version} is not in the registry (nearest ${known})`
          );
        }
      } else if (
        manifestCore &&
        knownCore &&
        manifestCore.major > knownCore.major
      ) {
        const level = mode === "strict" ? "error" : "warning";
        push(
          level,
          `Profile ${decl.id} major version ${decl.version} is newer than any known implementation (treat as unknown profile)`
        );
      } else {
        const level = mode === "strict" ? "error" : "warning";
        push(
          level,
          `Unknown coalition profile in manifest: ${decl.id} ${decl.version}`
        );
      }
    } else if (exact.status && exact.status !== "accepted") {
      if (exact.status === "rejected" && mode === "strict") {
        push(
          "error",
          `Profile ${decl.id} ${decl.version} has registry status rejected`
        );
      } else {
        push(
          "warning",
          `Profile ${decl.id} ${decl.version} has registry status ${exact.status}`
        );
      }
    }
  }

  for (const decl of vendorExtensions) {
    const inRegistry = findRegistryEntry(registry, decl.id, decl.version);
    if (!inRegistry && mode === "strict") {
      push(
        "warning",
        `Unknown vendor extension in manifest: ${decl.id} ${decl.version}`
      );
    }
  }

  const filesForProfile = new Map();
  for (const file of profileFiles) {
    const rel = file.filepath.replace(/^\.\//, "").replace(/\\/g, "/");
    const match = rel.match(/^profiles\/([^/]+)\//);
    if (!match) {
      push("error", `Profile file not under profiles/<id>/: ${file.filepath}`);
      continue;
    }
    const owner = match[1];
    if (!declaredProfileIds.has(owner)) {
      push(
        "error",
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
        `Profile filepath must be normalized (no ..): ${file.filepath}`
      );
    }
  }

  const filesForVendor = new Map();
  for (const file of vendorFiles) {
    const rel = file.filepath.replace(/^\.\//, "").replace(/\\/g, "/");
    const match = rel.match(/^vendor\/([^/]+)\//);
    if (!match) {
      push("error", `Vendor file not under vendor/<id>/: ${file.filepath}`);
      continue;
    }
    const owner = match[1];
    if (!declaredVendorIds.has(owner)) {
      push(
        "error",
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
      push("error", `Declared profile ${id} has no entries in profile_files`);
    }
  }
  for (const id of declaredVendorIds) {
    if (!filesForVendor.has(id) || filesForVendor.get(id).length === 0) {
      push(
        "error",
        `Declared vendor extension ${id} has no entries in vendor_extension_files`
      );
    }
  }

  const profileAjv = new Ajv({
    strict: false,
    validateSchema: false,
    allErrors: true,
  });
  addFormats(profileAjv);
  const objectTypeSchema = JSON.parse(
    fs.readFileSync("./schema/enums/ObjectType.schema.json", "utf8")
  );
  const objectReferenceSchema = JSON.parse(
    fs.readFileSync("./schema/types/ObjectReference.schema.json", "utf8")
  );
  profileAjv.addSchema(objectTypeSchema);
  profileAjv.addSchema(objectReferenceSchema);

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
    profileAjv.addSchema(profileSchema);

    const tolerateNewerMinor =
      schemaVersion !== decl.version &&
      parseSemverCore(decl.version)?.major ===
        parseSemverCore(schemaVersion)?.major;

    const files = filesForProfile.get(decl.id) ?? [];
    for (const file of files) {
      const absPath = normalizePackagePath(packageRoot, file.filepath);
      if (!fs.existsSync(absPath)) {
        push("error", `Profile file missing on disk: ${file.filepath}`);
        continue;
      }
      const payload = JSON.parse(await readFile(absPath, "utf8"));
      const validate = profileAjv.getSchema(profileSchema.$id);
      let valid = validate(payload);
      if (!valid && tolerateNewerMinor) {
        const permissiveAjv = new Ajv({
          strict: false,
          validateSchema: false,
          allErrors: true,
        });
        addFormats(permissiveAjv);
        permissiveAjv.addSchema(objectTypeSchema);
        permissiveAjv.addSchema(objectReferenceSchema);
        const relaxed = JSON.parse(JSON.stringify(profileSchema));
        const relaxAdditional = (node) => {
          if (!node || typeof node !== "object") {
            return;
          }
          if (node.type === "object" && node.additionalProperties === false) {
            node.additionalProperties = true;
          }
          for (const value of Object.values(node)) {
            if (typeof value === "object") {
              relaxAdditional(value);
            }
          }
        };
        relaxAdditional(relaxed);
        permissiveAjv.addSchema(relaxed);
        valid = permissiveAjv.getSchema(relaxed.$id)(payload);
        if (!valid) {
          push(
            "error",
            `Profile ${decl.id} file ${
              file.filepath
            } invalid against known schema ${schemaVersion}: ${JSON.stringify(
              permissiveAjv.errors
            )}`
          );
        }
      } else if (!valid) {
        push(
          "error",
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
