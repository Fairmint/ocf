import { resolve } from "path";
import {
  CURRENT_SCHEMA_ROOT,
  resolveOcfSchemaBundle,
  VENDORED_SCHEMA_RELEASES,
} from "./ocf-version.mjs";

describe("resolveOcfSchemaBundle", () => {
  test("1.3 manifest uses current in-repo schema root", () => {
    const bundle = resolveOcfSchemaBundle("1.3.0-alpha+main");
    expect(bundle.ok).toBe(true);
    expect(bundle.bundle).toBe("current");
    expect(bundle.schemaRoot).toBe(CURRENT_SCHEMA_ROOT);
    expect(bundle.fallback).toBe(false);
  });

  test("1.2.0 manifest uses vendored schema-releases/v1.2", () => {
    const bundle = resolveOcfSchemaBundle("1.2.0");
    expect(bundle.ok).toBe(true);
    expect(bundle.bundle).toBe("vendored");
    expect(bundle.schemaRoot).toBe(VENDORED_SCHEMA_RELEASES[2].schemaRoot);
    expect(bundle.schemaRoot).toContain(`${resolve("schema-releases/v1.2")}`);
    expect(bundle.fallback).toBe(false);
  });

  test("1.0.0 manifest falls back to current schemas with warning", () => {
    const bundle = resolveOcfSchemaBundle("1.0.0");
    expect(bundle.ok).toBe(true);
    expect(bundle.bundle).toBe("fallback");
    expect(bundle.schemaRoot).toBe(CURRENT_SCHEMA_ROOT);
    expect(bundle.fallback).toBe(true);
  });

  test("2.0.0 is unsupported", () => {
    expect(resolveOcfSchemaBundle("2.0.0").ok).toBe(false);
  });
});
