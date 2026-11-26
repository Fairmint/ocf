import { runRegisteredExtensionConformance } from "../lib/run-extension-conformance.mjs";
import { validateExtensionFixturePackage } from "../lib/extension-conformance-hook.mjs";

describe("registered extension conformance (wired)", () => {
  test("all registry rows run fixtures through validatePackage", async () => {
    const result = await runRegisteredExtensionConformance({
      validatePackage: validateExtensionFixturePackage,
    });
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.ranCases).toBeGreaterThan(0);
  });
});