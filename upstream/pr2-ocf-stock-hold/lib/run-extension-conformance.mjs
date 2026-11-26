import fs from "fs";
import { join } from "path";
import {
  loadRegistryIndex,
  listRegisteredConformanceRoots,
} from "./registry-index.mjs";

const FIXTURE_KINDS = ["compatible", "invalid", "warnings"];
const PROFILE_OVERLAY_NAMES = ["with-profiles", "with-profile"];

/**
 * Discover conformance cases per OCIP-0001 §6.1 (+ optional warnings/).
 * Fails discovery when a case directory exists without expected.json.
 * @param {string} fixtureRoot
 * @returns {{ cases: object[], violations: string[] }}
 */
export function discoverConformanceCases(fixtureRoot) {
  const cases = [];
  const violations = [];
  for (const kind of FIXTURE_KINDS) {
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
      if (!fs.existsSync(expectedPath)) {
        violations.push(
          `conformance case ${kind}/${name} missing expected.json under ${fixtureRoot}`
        );
        continue;
      }
      cases.push({
        kind,
        name,
        overlayPath: `${kind}/${name}`,
        expectedPath,
      });
    }
  }
  return { cases, violations };
}

function defaultProfileOverlays(fixtureRoot, caseOverlayPath) {
  for (const name of PROFILE_OVERLAY_NAMES) {
    if (fs.existsSync(join(fixtureRoot, name))) {
      return [name, caseOverlayPath];
    }
  }
  return [caseOverlayPath];
}

/**
 * Run package-level conformance for every registry row.
 * When `registry.profiles` is non-empty, callers **must** supply `hooks.validatePackage`
 * (wired in `tests/extension-conformance.test.mjs` for each extension).
 *
 * @param {{ validatePackage?: (fixtureRoot: string, overlayStack: string[], testCase: object) => Promise<{ errors: string[] }> }} hooks
 * @param {{ registry?: object, repoRoot?: string }} options
 */
export async function runRegisteredExtensionConformance(hooks = {}, options = {}) {
  const { registry, repoRoot } = options.registry
    ? { registry: options.registry, repoRoot: options.repoRoot ?? process.cwd() }
    : await loadRegistryIndex(options.repoRoot);

  const profiles = registry.profiles ?? [];
  const roots = listRegisteredConformanceRoots(registry, repoRoot);
  const outcomes = [];
  const violations = [];

  for (const { id, fixtureRoot } of roots) {
    if (!fs.existsSync(fixtureRoot)) {
      violations.push(`${id}: missing conformance-fixtures/${id}/`);
    }
  }

  if (profiles.length > 0) {
    if (typeof hooks.validatePackage !== "function") {
      violations.push(
        "registry lists profiles but no validatePackage hook was supplied; wire hooks in tests/extension-conformance.test.mjs"
      );
    }
  }

  if (violations.length > 0) {
    return { ok: false, outcomes, ranCases: 0, violations };
  }

  if (profiles.length === 0) {
    return { ok: true, outcomes, ranCases: 0, violations: [] };
  }

  let ranCases = 0;
  for (const { id, fixtureRoot } of roots) {
    const discovered = discoverConformanceCases(fixtureRoot);
    violations.push(...discovered.violations);
    if (discovered.cases.length === 0) {
      violations.push(`${id}: zero conformance cases discovered`);
      continue;
    }
    for (const testCase of discovered.cases) {
      ranCases += 1;
      const expected = JSON.parse(fs.readFileSync(testCase.expectedPath, "utf8"));
      const overlayStack =
        expected.overlays ??
        defaultProfileOverlays(fixtureRoot, testCase.overlayPath);
      const { errors } = await hooks.validatePackage(
        fixtureRoot,
        overlayStack,
        testCase
      );
      const wantErrors = expected.error_codes ?? [];
      let ok;
      if (testCase.kind === "compatible") {
        ok = errors.length === 0;
      } else if (testCase.kind === "invalid") {
        ok =
          JSON.stringify([...errors].sort()) ===
          JSON.stringify([...wantErrors].sort());
      } else {
        ok = wantErrors.every((code) => errors.includes(code));
      }
      outcomes.push({
        id,
        case: testCase.name,
        kind: testCase.kind,
        ok,
        errors,
        expected: wantErrors,
      });
    }
  }

  if (violations.length > 0) {
    return { ok: false, outcomes, ranCases, violations };
  }

  return {
    ok: outcomes.every((o) => o.ok),
    outcomes,
    ranCases,
    violations: [],
  };
}