import {
  loadRegistryIndex,
  validateRegistryAgainstSchema,
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
});

describe("registered extension conformance", () => {
  test("each registry profile has conformance-fixtures when listed", async () => {
    const { registry, repoRoot } = await loadRegistryIndex();
    const missing = assertConformanceDirectoriesExist(registry, repoRoot);
    expect(missing).toEqual([]);
  });

  test("conformance runner passes (zero or more extensions)", async () => {
    const result = await runRegisteredExtensionConformance();
    expect(result.ok).toBe(true);
    const { registry } = await loadRegistryIndex();
    if (registry.profiles.length === 0) {
      expect(result.ranCases).toBe(0);
    }
  });
});