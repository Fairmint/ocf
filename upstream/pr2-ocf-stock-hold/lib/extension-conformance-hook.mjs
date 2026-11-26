import { readFile } from "fs/promises";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getOcfValidator,
  getOcfFilesFromDir,
  validateOcfDirectory,
} from "./validate-ocf-package.mjs";
import {
  buildOcfObjectIndex,
  validatePackageExtensions,
} from "./validate-extensions.mjs";
import {
  materializeFixturePackage,
  removeMaterializedPackage,
} from "./conformance-fixture-harness.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_PATH = join(REPO_ROOT, "registry.json");

/**
 * @param {string} fixtureRoot
 * @param {string[]} overlayStack
 * @param {{ kind: string }} testCase
 */
export async function validateExtensionFixturePackage(
  fixtureRoot,
  overlayStack,
  testCase
) {
  const packageRoot = materializeFixturePackage(fixtureRoot, overlayStack);
  try {
    if (testCase.kind === "compatible") {
      const ocfOk = await validateOcfDirectory(packageRoot, false, false, {
        registryRoot: REPO_ROOT,
      });
      if (!ocfOk) {
        return { errors: ["ocf_package_invalid"] };
      }
    }
    const ajv = await getOcfValidator(false, false, false, false);
    const paths = await getOcfFilesFromDir(packageRoot);
    const parsed = {};
    for (const p of paths) {
      parsed[p] = JSON.parse(await readFile(p, "utf8"));
    }
    const manifest = Object.values(parsed).find(
      (o) => o.file_type === "OCF_MANIFEST_FILE"
    );
    const result = await validatePackageExtensions(manifest, packageRoot, {
      ajv,
      ocfObjectIndex: buildOcfObjectIndex(parsed),
      ocfParsedByPath: parsed,
      mode: "standard",
      registryPath: REGISTRY_PATH,
      registryRoot: REPO_ROOT,
    });
    return {
      errors: result.issues
        .filter((i) => i.level === "error")
        .map((i) => i.code),
    };
  } finally {
    removeMaterializedPackage(packageRoot);
  }
}