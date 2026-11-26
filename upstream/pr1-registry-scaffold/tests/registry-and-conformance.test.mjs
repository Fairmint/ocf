import {
  loadRegistryIndex,
  validateRegistryAgainstSchema,
  assertRegistryInvariants,
  assertConformanceDirectoriesExist,
} from "../lib/registry-index.mjs";
import { runRegisteredExtensionConformance } from "../lib/run-extension-conformance.mjs";

describe("registry index", () => {
  test("registry.json validates against registry.schema.json", async () => {
    const { registry, repoRoot } = await loadRegistryIndex();
    const { ok, errors } = await validateRegistryAgainstSchema(
      registry,
      repoRoot
    );
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });

  test("registry satisfies file and naming invariants", async () => {
    const { registry, repoRoot } = await loadRegistryIndex();
    expect(assertRegistryInvariants(registry, repoRoot)).toEqual([]);
  });
});

describe("registered extension conformance", () => {
  test("each registry profile has conformance-fixtures when listed", async () => {
    const { registry, repoRoot } = await loadRegistryIndex();
    const missing = assertConformanceDirectoriesExist(registry, repoRoot);
    expect(missing).toEqual([]);
  });

  test("zero profiles passes without validatePackage hook", async () => {
    const result = await runRegisteredExtensionConformance();
    expect(result.ok).toBe(true);
    expect(result.ranCases).toBe(0);
    expect(result.violations).toEqual([]);
  });
});