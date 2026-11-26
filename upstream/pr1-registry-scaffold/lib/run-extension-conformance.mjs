import fs from "fs";
import { join } from "path";
import {
  loadRegistryIndex,
  listRegisteredConformanceRoots,
} from "./registry-index.mjs";

/**
 * Discover compatible / invalid fixture cases for a registered extension.
 * @param {string} fixtureRoot
 */
export function discoverConformanceCases(fixtureRoot) {
  const cases = [];
  for (const kind of ["compatible", "invalid"]) {
    const dir = join(fixtureRoot, kind);
    if (!fs.existsSync(dir)) {
      continue;
    }
    for (const name of fs.readdirSync(dir)) {
      const caseDir = join(dir, name);
      if (!fs.statSync(caseDir).isDirectory()) {
        continue;
      }
      const expectedPath = join(caseDir, "expected.json");
      if (fs.existsSync(expectedPath)) {
        cases.push({
          kind,
          name,
          overlayPath: `${kind}/${name}`,
          expectedPath,
        });
      }
    }
  }
  return cases;
}

/**
 * Run package-level conformance for every registry row.
 * Scaffold repo: verifies structure only (no OCF validator until an extension ships).
 *
 * @param {{ validatePackage?: (fixtureRoot: string, overlayStack: string[]) => Promise<{ errors: string[] }> }} hooks
 */
export async function runRegisteredExtensionConformance(hooks = {}) {
  const { registry, repoRoot } = await loadRegistryIndex();
  const roots = listRegisteredConformanceRoots(registry, repoRoot);
  const outcomes = [];

  for (const { id, fixtureRoot } of roots) {
    if (!fs.existsSync(fixtureRoot)) {
      outcomes.push({ id, ok: false, reason: "missing conformance-fixtures tree" });
      continue;
    }
  }

  if (!hooks.validatePackage) {
    return { ok: outcomes.every((o) => o.ok !== false), outcomes, ranCases: 0 };
  }

  let ranCases = 0;
  for (const { id, fixtureRoot } of roots) {
    const cases = discoverConformanceCases(fixtureRoot);
    for (const testCase of cases) {
      ranCases += 1;
      const expected = JSON.parse(fs.readFileSync(testCase.expectedPath, "utf8"));
      const overlayStack = expected.overlays ?? ["with-profile", testCase.overlayPath];
      const { errors } = await hooks.validatePackage(fixtureRoot, overlayStack);
      const wantErrors = expected.error_codes ?? [];
      const ok =
        testCase.kind === "compatible"
          ? errors.length === 0
          : wantErrors.every((code) => errors.includes(code));
      outcomes.push({ id, case: testCase.name, kind: testCase.kind, ok, errors });
    }
  }

  return {
    ok: outcomes.every((o) => o.ok !== false),
    outcomes,
    ranCases,
  };
}