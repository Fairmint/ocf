import crypto from "crypto";
import fs from "fs";
import { normalize, resolve } from "path";
import { EXTENSION_ERROR_CODES as C } from "./extension-error-codes.mjs";

const MANIFEST_FILE_ARRAY_KEYS = [
  "stock_plans_files",
  "stock_legend_templates_files",
  "stock_classes_files",
  "vesting_terms_files",
  "valuations_files",
  "transactions_files",
  "stakeholders_files",
  "financings_files",
  "documents_files",
  "profile_files",
  "vendor_extension_files",
];

function normalizePackagePath(packageRoot, filepath) {
  const withoutDot = filepath.replace(/^\.\//, "");
  return normalize(resolve(packageRoot, withoutDot));
}

function md5Hex(buffer) {
  return crypto.createHash("md5").update(buffer).digest("hex");
}

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * @param {object} manifest
 * @param {string} packageRoot
 * @returns {{ ok: boolean, issues: import('./validate-extensions.mjs').ExtensionIssue[] }}
 */
export function verifyManifestFileDigests(manifest, packageRoot) {
  /** @type {import('./validate-extensions.mjs').ExtensionIssue[]} */
  const issues = [];

  const push = (level, code, message) => {
    issues.push({ level, code, message });
  };

  for (const key of MANIFEST_FILE_ARRAY_KEYS) {
    const entries = manifest[key];
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const entry of entries) {
      if (!entry?.filepath || !entry?.md5) {
        continue;
      }
      const absPath = normalizePackagePath(packageRoot, entry.filepath);
      if (!fs.existsSync(absPath)) {
        push(
          "error",
          C.PACKAGE_FILE_MISSING,
          `Manifest lists missing file (${key}): ${entry.filepath}`
        );
        continue;
      }
      const buffer = fs.readFileSync(absPath);
      if (entry.sha256) {
        const actualSha = sha256Hex(buffer);
        if (actualSha.toLowerCase() !== String(entry.sha256).toLowerCase()) {
          push(
            "error",
            C.PACKAGE_FILE_SHA256_MISMATCH,
            `SHA-256 mismatch for ${entry.filepath}: manifest ${entry.sha256}, actual ${actualSha}`
          );
        }
      } else {
        const actualMd5 = md5Hex(buffer);
        if (actualMd5.toLowerCase() !== String(entry.md5).toLowerCase()) {
          push(
            "error",
            C.PACKAGE_FILE_MD5_MISMATCH,
            `MD5 mismatch for ${entry.filepath}: manifest ${entry.md5}, actual ${actualMd5}`
          );
        }
      }
    }
  }

  return { ok: issues.filter((i) => i.level === "error").length === 0, issues };
}
