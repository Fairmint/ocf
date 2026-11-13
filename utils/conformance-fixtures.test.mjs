import fs from "fs";
import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { createHash } from "crypto";
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

const FIXTURE_ROOT = resolve(
  "OCIP/conformance-fixtures/transfer-reason-simple"
);

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

function sha256File(path) {
  const data = fs.readFileSync(path);
  return createHash("sha256").update(data).digest("hex");
}

function extractCapTableSnapshot(packageRoot) {
  const txPath = join(packageRoot, "Transactions.ocf.json");
  const transactions = JSON.parse(fs.readFileSync(txPath, "utf8"));
  const transfers = transactions.items
    .filter((i) => i.object_type === "TX_STOCK_TRANSFER")
    .map((i) => ({
      id: i.id,
      object_type: i.object_type,
      quantity: i.quantity,
    }));
  const manifest = JSON.parse(
    fs.readFileSync(join(packageRoot, "Manifest.ocf.json"), "utf8")
  );
  return {
    issuer_id: manifest.issuer.id,
    stock_transfers: transfers,
  };
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

describe("OCIP-0001 transfer-reason-simple conformance fixtures", () => {
  test("base and materialized with-profiles share identical OCF payloads (excludes Manifest)", () => {
    const base = join(FIXTURE_ROOT, "base");
    const pkg = materialize("with-profiles");
    const names = fs
      .readdirSync(base)
      .filter((n) => n.endsWith(".ocf.json") && n !== "Manifest.ocf.json");
    for (const name of names) {
      expect(sha256File(join(pkg, name))).toBe(sha256File(join(base, name)));
    }
  });

  test("expected/cap_table_snapshot.json matches OCF-only extract from base and from with-profiles", () => {
    const expected = JSON.parse(
      fs.readFileSync(
        join(FIXTURE_ROOT, "expected/cap_table_snapshot.json"),
        "utf8"
      )
    );
    const fromBase = extractCapTableSnapshot(join(FIXTURE_ROOT, "base"));
    const fromWithProfiles = extractCapTableSnapshot(
      materialize("with-profiles")
    );
    expect(fromBase).toEqual(fromWithProfiles);
    expect(fromBase.issuer_id).toBe(expected.issuer_id);
    expect(fromBase.stock_transfers).toEqual(expected.stock_transfers);
  });

  test("materialized with-profiles passes OCF directory validation", async () => {
    const ok = await validateOcfDirectory(
      materialize("with-profiles"),
      false,
      false
    );
    expect(ok).toBe(true);
  });

  test.each(
    fs
      .readdirSync(join(FIXTURE_ROOT, "compatible"))
      .map((name) => [name, `compatible/${name}`])
  )(
    "compatible overlay %s passes OCF directory validation",
    async (name, overlayPath) => {
      const expected = JSON.parse(
        fs.readFileSync(
          join(FIXTURE_ROOT, overlayPath, "expected.json"),
          "utf8"
        )
      );
      const overlayStack = expected.overlays ?? [overlayPath];
      const pkg = materialize(...overlayStack);
      const ok = await validateOcfDirectory(pkg, false, false);
      expect(ok).toBe(true);
      const { errors } = await extensionIssuesForPackage(pkg);
      expect(errors).toEqual([]);
    }
  );

  test("re-export pass-through preserves profile payloads and references", async () => {
    const source = materialize("with-profiles");
    const profilePath = join(
      source,
      "profiles/ocf.transfer-reason/transfer-reasons.json"
    );
    const before = fs.readFileSync(profilePath, "utf8");
    const ok = await validateOcfDirectory(source, false, false);
    expect(ok).toBe(true);
    expect(fs.readFileSync(profilePath, "utf8")).toBe(before);
  });

  test.each(
    fs
      .readdirSync(join(FIXTURE_ROOT, "invalid"))
      .map((name) => [name, `invalid/${name}`])
  )(
    "invalid overlay %s emits expected error codes",
    async (name, overlayPath) => {
      const expected = JSON.parse(
        fs.readFileSync(
          join(FIXTURE_ROOT, overlayPath, "expected.json"),
          "utf8"
        )
      );
      const overlayStack = expected.overlays ?? ["with-profiles", overlayPath];
      const pkg = materialize(...overlayStack);
      const { errors } = await extensionIssuesForPackage(pkg);
      for (const code of expected.error_codes ?? []) {
        expect(errors).toContain(code);
      }
    }
  );

  test.each(
    fs
      .readdirSync(join(FIXTURE_ROOT, "warnings"))
      .map((name) => [name, `warnings/${name}`])
  )(
    "warning overlay %s emits expected warning codes",
    async (name, overlayPath) => {
      const expected = JSON.parse(
        fs.readFileSync(
          join(FIXTURE_ROOT, overlayPath, "expected.json"),
          "utf8"
        )
      );
      const overlayStack = expected.overlays ?? ["with-profiles", overlayPath];
      const pkg = materialize(...overlayStack);
      const { errors, warnings } = await extensionIssuesForPackage(pkg);
      for (const code of expected.warning_codes ?? []) {
        expect(warnings).toContain(code);
      }
      expect(errors).not.toContain("profile_economic_violation");
      if (expected.error_codes) {
        for (const code of expected.error_codes) {
          expect(errors).toContain(code);
        }
      } else {
        expect(errors).toEqual([]);
      }
      const directoryOk = await validateOcfDirectory(pkg, false, false);
      expect(directoryOk).toBe((expected.error_codes ?? []).length === 0);
    }
  );
});
