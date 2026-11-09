import fs from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { getOcfValidator, getOcfFilesFromDir } from "./validate.mjs";
import {
  assertProfileSchemaDraft07,
  buildOcfObjectIndex,
  compileProfileSchema,
  validatePackageExtensions,
} from "./validate-extensions.mjs";
import { DRAFT_07_META } from "./extension-error-codes.mjs";

const PROFILE_SCHEMA_PATH = "profiles/ocf.transfer-reason/1.0.0/schema.json";

describe("profile schema draft-07 and AJV integration", () => {
  test("transfer-reason profile schema is draft-07 and compiles on the OCF validator", async () => {
    const raw = fs.readFileSync(PROFILE_SCHEMA_PATH, "utf8");
    const profileSchema = JSON.parse(raw);
    expect(profileSchema.$schema).toBe(DRAFT_07_META);
    assertProfileSchemaDraft07(profileSchema);

    const ajv = await getOcfValidator(false, false, false, false);
    const validate = compileProfileSchema(ajv, profileSchema);
    const sample = JSON.parse(
      await readFile(
        "samples/profiles/ocf.transfer-reason/transfer-reasons.json",
        "utf8"
      )
    );
    expect(validate(sample)).toBe(true);
  });

  test("draft 2020-12 profile meta-schema is rejected", () => {
    expect(() =>
      assertProfileSchemaDraft07({
        $schema: "https://json-schema.org/draft/2020-12/schema",
      })
    ).toThrow(/draft-07/);
  });

  test("with-profiles fixture validates extensions using preloaded OCF $ref targets", async () => {
    const packageRoot = resolve(
      "OCIP/conformance-fixtures/transfer-reason-simple/with-profiles"
    );
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
      mode: "standard",
    });
    const errors = result.issues.filter((i) => i.level === "error");
    expect(errors).toEqual([]);
  });
});
