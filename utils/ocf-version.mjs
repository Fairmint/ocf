import fs from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { EXTENSION_ERROR_CODES as C } from "./extension-error-codes.mjs";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

/** @readonly */
export const IMPLEMENTED_OCF_VERSION = "1.3.0-alpha+main";

/** @readonly */
export const CURRENT_SCHEMA_ROOT = resolve(REPO_ROOT, "schema");

/** @readonly */
export const VENDORED_SCHEMA_RELEASES = {
  2: {
    schemaRoot: resolve(REPO_ROOT, "schema-releases/v1.2"),
    sourceTag: "v1.2.0",
  },
};

/**
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number } | null}
 */
export function parseOcfSemverCore(version) {
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

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareOcfSemverCore(a, b) {
  const av = parseOcfSemverCore(a);
  const bv = parseOcfSemverCore(b);
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

/**
 * @typedef {{
 *   ok: boolean,
 *   reason?: string,
 *   message?: string,
 *   declaredMinor?: number,
 *   implementedMinor?: number,
 *   schemaRoot?: string,
 *   bundle?: "current" | "vendored" | "fallback",
 *   sourceTag?: string | null,
 *   fallback?: boolean
 * }} OcfSchemaBundleResolution
 */

/**
 * Resolve the on-disk JSON Schema root for a package `ocf_version`.
 *
 * @param {string} ocfVersion
 * @returns {OcfSchemaBundleResolution}
 */
export function resolveOcfSchemaBundle(ocfVersion) {
  const declared = parseOcfSemverCore(ocfVersion);
  const implemented = parseOcfSemverCore(IMPLEMENTED_OCF_VERSION);
  if (!declared || !implemented) {
    return {
      ok: false,
      reason: "unparseable",
      message: `Cannot parse ocf_version: ${JSON.stringify(ocfVersion)}`,
    };
  }
  if (declared.major !== 1) {
    return {
      ok: false,
      reason: "unsupported_major",
      message: `OCF major version ${declared.major} is not supported (only 1.x)`,
    };
  }
  if (declared.minor > implemented.minor) {
    return {
      ok: false,
      reason: "newer_minor_than_implemented",
      message: `Package declares OCF 1.${declared.minor}.x but validator implements up to 1.${implemented.minor}.x (${IMPLEMENTED_OCF_VERSION})`,
    };
  }

  if (declared.minor === implemented.minor) {
    return {
      ok: true,
      declaredMinor: declared.minor,
      implementedMinor: implemented.minor,
      schemaRoot: CURRENT_SCHEMA_ROOT,
      bundle: "current",
      sourceTag: null,
      fallback: false,
      message: `Using in-repo schema bundle for OCF 1.${implemented.minor}.x`,
    };
  }

  const vendored = VENDORED_SCHEMA_RELEASES[declared.minor];
  if (vendored && fs.existsSync(vendored.schemaRoot)) {
    return {
      ok: true,
      declaredMinor: declared.minor,
      implementedMinor: implemented.minor,
      schemaRoot: vendored.schemaRoot,
      bundle: "vendored",
      sourceTag: vendored.sourceTag,
      fallback: false,
      message: `Using vendored OCF 1.${declared.minor}.x schemas from tag ${vendored.sourceTag}`,
    };
  }

  return {
    ok: true,
    declaredMinor: declared.minor,
    implementedMinor: implemented.minor,
    schemaRoot: CURRENT_SCHEMA_ROOT,
    bundle: "fallback",
    sourceTag: null,
    fallback: true,
    message: `No vendored schema bundle for OCF 1.${declared.minor}.x; validating against in-repo 1.${implemented.minor}.x schemas (${C.OCF_VERSION_SCHEMA_FALLBACK})`,
  };
}
