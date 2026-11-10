import fs from "fs";
import { readFile } from "fs/promises";
import { join, resolve } from "path";
import {
  getOcfValidator,
  getOcfFilesFromDir,
  validateOcfDirectory,
} from "./validate.mjs";
import {
  buildOcfObjectIndex,
  validatePackageExtensions,
} from "./validate-extensions.mjs";
import {
  materializeFixturePackage,
  removeMaterializedPackage,
} from "./conformance-fixture-harness.mjs";

const FIXTURE_ROOT = resolve("OCIP/conformance-fixtures/stock-hold");
const materializedDirs = [];

afterEach(() => {
  for (const dir of materializedDirs.splice(0)) {
    removeMaterializedPackage(dir);
  }
});

function materialize(...overlayPaths) {
  const dir = materializeFixturePackage(FIXTURE_ROOT, overlayPaths);
  materializedDirs.push(dir);
  return dir;
}

async function extensionIssuesForPackage(packageRoot) {
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
  });
  return {
    errors: result.issues.filter((i) => i.level === "error").map((i) => i.code),
    warnings: result.issues
      .filter((i) => i.level === "warning")
      .map((i) => i.code),
  };
}

describe("OCIP stock-hold conformance fixtures", () => {
  test.each(
    fs
      .readdirSync(join(FIXTURE_ROOT, "compatible"))
      .map((name) => [name, `compatible/${name}`])
  )("compatible overlay %s passes validation", async (name, overlayPath) => {
    const expected = JSON.parse(
      fs.readFileSync(join(FIXTURE_ROOT, overlayPath, "expected.json"), "utf8")
    );
    const overlayStack = expected.overlays ?? ["with-profile", overlayPath];
    const pkg = materialize(...overlayStack);
    expect(await validateOcfDirectory(pkg, false, false)).toBe(true);
    const { errors, warnings } = await extensionIssuesForPackage(pkg);
    expect(errors).toEqual([]);
    expect(warnings).not.toContain("profile_economic_violation");
  });

  test.each(
    fs
      .readdirSync(join(FIXTURE_ROOT, "invalid"))
      .map((name) => [name, `invalid/${name}`])
  )("invalid overlay %s emits expected errors", async (name, overlayPath) => {
    const expected = JSON.parse(
      fs.readFileSync(join(FIXTURE_ROOT, overlayPath, "expected.json"), "utf8")
    );
    const overlayStack = expected.overlays ?? ["with-profile", overlayPath];
    const pkg = materialize(...overlayStack);
    const { errors } = await extensionIssuesForPackage(pkg);
    for (const code of expected.error_codes ?? []) {
      expect(errors).toContain(code);
    }
  });
});
