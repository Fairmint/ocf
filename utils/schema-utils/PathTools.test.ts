import {
  basenameRelativePathToSchemaDir,
  relativePathToOtherPath,
  schemaUrlFromRepoPath,
} from "./PathTools";

describe("relativePathToOtherPath", () => {
  it("should return the relative path to the target path from the source path", () => {
    const source_path = "/same/directory/file.json";
    const target_path = "/same/directory/other_file.json";

    expect(relativePathToOtherPath(target_path, source_path)).toEqual(".");
  });
});

describe("basenameRelativePathToSchemaDir", () => {
  it("returns the dir-relative basename for an ordinary schema path", () => {
    expect(
      basenameRelativePathToSchemaDir(
        "./schema/enums/AllocationType.schema.json"
      )
    ).toEqual("enums/AllocationType");
  });

  it("keeps a multi-dot `.v#` versioned-shape basename intact", () => {
    // `VestingTerms.v1` must not be mistaken for a file extension and
    // truncated to its parent directory.
    expect(
      basenameRelativePathToSchemaDir(
        "./schema/objects/versions/VestingTerms.v1.schema.json"
      )
    ).toEqual("objects/versions/VestingTerms.v1");
  });
});

describe("schemaUrlFromRepoPath", () => {
  it("builds the repo URL for a `.v#` versioned shape without dropping the basename", () => {
    expect(
      schemaUrlFromRepoPath(
        "./schema/objects/transactions/issuance/versions/EquityCompensationIssuance.v1.schema.json"
      )
    ).toEqual(
      "https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/tree/main/schema/objects/transactions/issuance/versions/EquityCompensationIssuance.v1.schema.json"
    );
  });
});
