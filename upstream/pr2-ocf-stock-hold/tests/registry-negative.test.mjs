import fs from "fs";
import { mkdtempSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  assertRegistryInvariants,
  validateRegistryAgainstSchema,
} from "../lib/registry-index.mjs";
import { runRegisteredExtensionConformance } from "../lib/run-extension-conformance.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const baseRow = {
  id: "ocf.test-fixture",
  version: "1.0.0",
  status: "draft",
  schema: "profiles/ocf.test-fixture/1.0.0/schema.json",
  spec: "specs/ocf.test-fixture.md",
  requires_ocf: ">=1.3.0",
  min_ocf_version: "1.3.0",
  requires_profiles: [],
  owner: "coalition",
};

describe("assertRegistryInvariants negative cases", () => {
  test("duplicate (id, version)", () => {
    const registry = {
      version: "1.0.0",
      profiles: [baseRow, { ...baseRow }],
    };
    const v = assertRegistryInvariants(registry, REPO_ROOT);
    expect(v.some((m) => m.includes("duplicate"))).toBe(true);
  });

  test("schema path with ..", () => {
    const registry = {
      version: "1.0.0",
      profiles: [
        {
          ...baseRow,
          schema: "profiles/../evil/schema.json",
        },
      ],
    };
    const v = assertRegistryInvariants(registry, REPO_ROOT);
    expect(v.length).toBeGreaterThan(0);
  });

  test("missing schema file on disk", () => {
    const registry = { version: "1.0.0", profiles: [baseRow] };
    const v = assertRegistryInvariants(registry, REPO_ROOT);
    expect(v.some((m) => m.includes("missing on disk"))).toBe(true);
  });

  test("rejects junk semver in schema validation", async () => {
    const registry = {
      version: "1.0.0foo",
      profiles: [],
    };
    const { ok } = await validateRegistryAgainstSchema(registry, REPO_ROOT);
    expect(ok).toBe(false);
  });
});

describe("runRegisteredExtensionConformance negative cases", () => {
  test("fails when profiles exist but no validatePackage hook", async () => {
    const registry = { version: "1.0.0", profiles: [baseRow] };
    const result = await runRegisteredExtensionConformance(
      {},
      { registry, repoRoot: REPO_ROOT }
    );
    expect(result.ok).toBe(false);
    expect(
      result.violations.some((m) => m.includes("validatePackage hook"))
    ).toBe(true);
  });

  test("fails when zero conformance cases discovered", async () => {
    const tmpRepo = mkdtempSync(join(tmpdir(), "ext-reg-zero-"));
    const id = "ocf.zero-cases";
    const schemaRel = `profiles/${id}/1.0.0/schema.json`;
    mkdirSync(join(tmpRepo, "profiles", id, "1.0.0"), { recursive: true });
    fs.writeFileSync(join(tmpRepo, schemaRel), "{}");
    mkdirSync(join(tmpRepo, "conformance-fixtures", id, "base"), {
      recursive: true,
    });
    fs.writeFileSync(
      join(tmpRepo, "conformance-fixtures", id, "base", "stub.ocf.json"),
      "{}"
    );
    const registry = {
      version: "1.0.0",
      profiles: [
        {
          ...baseRow,
          id,
          schema: schemaRel,
          spec: undefined,
        },
      ],
    };
    const result = await runRegisteredExtensionConformance(
      {
        validatePackage: async () => ({ errors: [] }),
      },
      { registry, repoRoot: tmpRepo }
    );
    expect(result.ok).toBe(false);
    expect(
      result.violations.some((m) => m.includes("zero conformance cases"))
    ).toBe(true);
  });
});