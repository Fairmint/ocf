import Ajv from "ajv";
import addFormats from "ajv-formats";
import fs from "fs";
import { readFile, readdir } from "fs/promises";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  validatePackageExtensions,
  buildOcfObjectIndex,
} from "./validate-extensions.mjs";
import { resolveOcfSchemaBundle } from "./ocf-version.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function failOnTest(test, message) {
  if (test) {
    throw new Error(message);
  }
}

export function getOcfSchemaRoot() {
  return process.env.OCF_SCHEMA_ROOT ?? join(REPO_ROOT, "vendor", "ocf-schema");
}

function schemaPath(...segments) {
  return join(getOcfSchemaRoot(), ...segments);
}

// build map of object_type to schema $id
// throws if an unknown object_type value is encountered
async function buildObjectSchemaMap(verbose = false) {
  const object_schemas_map = {};
  const object_schema_paths = await getSchemaObjectsFilepaths(verbose);
  const object_schema_buffers = await Promise.all(
    object_schema_paths.map((path) => readFile(path))
  );
  const object_schemas = object_schema_buffers.map((schema_buffer) => {
    return JSON.parse(schema_buffer.toString());
  });

  const object_type_enum_schema = JSON.parse(
    fs.readFileSync(schemaPath("schema", "enums", "ObjectType.schema.json")).toString()
  );

  // Need to update this to handle the two options for object_type props (stll not in
  // love with this choice, but it was required to avoid a breaking change). Where
  // a schema has multiple potential object types for backwards compatibility,
  // there is a mapping entry for each object type in the object_type.oneOf array
  // for each of the const values in that array to the $id of the given schema
  object_schemas.forEach((object_schema) => {
    if (object_schema.properties) {
      const object_type = object_schema.properties.object_type;

      if (
        typeof object_type === "object" &&
        !Array.isArray(object_type) &&
        object_type !== null
      ) {
        if (object_type.const && typeof object_type.const === "string") {
          if (!object_type_enum_schema.enum.includes(object_type.const)) {
            throw new Error(
              `Encountered object_type: ${object_type.const} in a schema but this type does not exist in ObjectType.schema.json`
            );
          }

          object_schemas_map[object_type.const] = object_schema.$id;
        } else if (object_type.enum && Array.isArray(object_type.enum)) {
          for (const item of object_type.enum) {
            if (item) {
              object_schemas_map[item] = object_schema.$id;
            }
          }
        } else {
          console.error(
            `Unexpected value for object_type: ${object_type} in schema:\n ${JSON.stringify(
              object_schema,
              null,
              4
            )}`
          );
        }
      }
    } else if (object_schema["x-ocf-version-dispatcher"] === true) {
      if (verbose) {
        console.log(
          `Schema ${object_schema.$id} is a version dispatcher; skipping object_type map entry`
        );
      }
    } else if (
      object_schema["$id"] &&
      object_schema.allOf &&
      Array.isArray(object_schema.allOf) &&
      object_schema.allOf.length === 1
    ) {
      /**
       * We have an issue with proposed backwards compatibility wrappers... the validator expects
       * that each object_type maps to exactly one corresponding schema $id, but the wrappers don't have an
       * object_type property directly. Since schemaMap maps the type constants to the desired $id,
       * we can actually ignore the wrapper mappings because the object_type constants should end up in the
       * schemaMap when we look at the schema that the wrapper references. Those referenced schemas should
       * validate objects built against the wrapper schema.
       */
      if (verbose) {
        console.log(
          `Appears schema ${object_schema["$id"]} is a wrapper for ${object_schema.allOf[0]["$ref"]}... ignoring.`
        );
      }
    } else {
      console.error(
        `Unexpected value for schema: ${JSON.stringify(object_schema, null, 4)}`
      );
      throw new Error(
        "Schema doesn't match OCF schema format and it's not a wrapper"
      );
    }
  });

  return object_schemas_map;
}

// SO @https://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
async function* getFiles(dir) {
  /**
   *  Given a directory, recursively (and async) load all file (NOT dir) paths.
   *  Returns list of paths.
   */
  const dirents = await readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* getFiles(res);
    } else {
      yield res;
    }
  }
}

async function getSchemaObjectsFilepaths(verbose = false) {
  /**
   * Crawl ./schema directory from repo root and get all
   * of the filepaths to schema files (ending in .schema.json)
   */
  const paths = [];
  for await (const f of getFiles(schemaPath("schema", "objects"))) {
    paths.push(f);
  }
  return paths;
}

async function getSchemaFilepaths(verbose = false) {
  /**
   * Crawl ./schema directory from repo root and get all
   * of the filepaths to schema files (ending in .schema.json)
   */
  const paths = [];
  for await (const f of getFiles(schemaPath("schema"))) {
    paths.push(f);
    if (verbose) {
      console.log(`•\t${f}`);
    }
  }
  return paths;
}

export async function getOcfValidator(
  verbose = false,
  check_schema_validity = true,
  test = false,
  show_all_errors = false
) {
  try {
    if (verbose) console.log("\n-->\tLoad Schema Files...\n");
    const schema_paths = await getSchemaFilepaths(verbose);
    const schema_buffers = await Promise.all(
      schema_paths.map((path) => readFile(path))
    );
    const schemas = schema_buffers.map((schema_buffer) => {
      return JSON.parse(schema_buffer.toString());
    });
    const ajv = new Ajv({
      schemas,
      validateSchema: check_schema_validity ? true : "log",
      ...(show_all_errors ? { allErrors: true, verbose } : {}),
    });
    addFormats(ajv);
    return ajv;
  } catch (e) {
    failOnTest(test, `Could not load OCF validator: ${e.message}`);
    if (verbose) {
      console.log(`\tXX\tCould not load validator: ${e.message}`);
    }
    return undefined;
  }
}

export async function getOcfFilesFromDir(path, verbose = false) {
  /**
   * Crawl a provided directory and fetch paths to files
   * ending in .ocf.json
   */
  if (verbose)
    console.log(`\n-->\tgetOcfFilesFromDir from root directory:\t${path}`);

  const paths = [];
  for await (const f of getFiles(path)) {
    if (f.substring(f.length - 9) === ".ocf.json") {
      paths.push(f);
      if (verbose) {
        console.log(`\t•\t${f}`);
      }
    }
  }
  if (verbose) console.log("-->\tDONE!");
  return paths;
}

/**
 * Reads the dictionary of URIs for file types lookup from UriLookupForFileType.json
 * @returns a dictionary with the URIs for file types lookup
 */
function readUriLookupForFileTypes() {
  var buffer = fs.readFileSync(
    join(getOcfSchemaRoot(), "utils/schema-utils/UriLookupForFileType.json")
  );
  return JSON.parse(buffer.toString());
}

/**
 * Meant to validate our new multi-file format. Point it at a directory
 * with ocf file jsons, and it will first identify all files with .ocf.json
 * extensions, then load each one, then check for a file_type and then
 * validate against the file type's schema.
 * @param {string} path - path to the root directory to start search from
 * @param {boolean} verbose - if true, will output status to console
 * @param {boolean} test - if true, will trigger github actions core.setFailed on failure
 * @returns true if validations pass, false if otherwise
 */
export async function validateOcfDirectory(
  path,
  verbose = false,
  test = false,
  extensionOptions = {}
) {
  try {
    const ajv = await getOcfValidator(verbose, false, false, false);
    const ocf_paths = await getOcfFilesFromDir(path, verbose);

    if (verbose)
      console.log("\n--- Loading URI Lookup for file types ---------------");
    const uriLookupForFileType = readUriLookupForFileTypes();

    if (verbose)
      console.log("\n--- Loading OCF File Buffers... ---------------");
    const ocf_file_buffers = await Promise.all(
      ocf_paths.map((path) => readFile(path))
    );

    if (verbose) console.log("\n--- Validate OCF Files ---------------");
    let manifestObj = null;
    const parsedOcfByPath = {};
    for (let i = 0; i < ocf_file_buffers.length; i++) {
      if (verbose) console.log(`\n${i + 1})\tAnalyze File: ${ocf_paths[i]}`);
      const obj = JSON.parse(ocf_file_buffers[i].toString());
      parsedOcfByPath[ocf_paths[i]] = obj;
      if (verbose) {
        console.log(`\tOCF File Type: ${obj.file_type}`);
        console.log(`\tFile Type URI: ${uriLookupForFileType[obj.file_type]}`);
      }

      // if file is manifest, just validate against the manifest schema
      if (obj.file_type === "OCF_MANIFEST_FILE") {
        const ocfBundle = resolveOcfSchemaBundle(obj.ocf_version);
        if (!ocfBundle.ok) {
          if (verbose) {
            console.log(`\n\tXX UNSUPPORTED ocf_version: ${obj.ocf_version}`);
            console.log(`\t${ocfBundle.message}`);
          }
          failOnTest(test, `Unsupported ocf_version: ${obj.ocf_version}`);
          return false;
        }
        if (verbose && ocfBundle.loadFromRelease) {
          console.log(`\t${ocfBundle.message}`);
        }
        const validator = ajv.getSchema(uriLookupForFileType[obj.file_type]);
        const valid = validator(obj);

        if (!valid) {
          console.log(`\n\tXX INVALID DUE TO ERRORS:`);
          console.log(validator.errors);
          failOnTest(
            test,
            `OCF @${ocf_paths[i]} failed validation: ${JSON.stringify(validator.errors)}`
          );
          return false;
        } else {
          if (verbose) console.log(`\t** VALID OCF **`);
          manifestObj = obj;
        }
        // collect the errors per file and then return them
        // if file is not a manifest, loop through items
        // for each item, get the object_type and then run the validator against that schema
      } else if (obj.hasOwnProperty("items")) {
        const objectTypeToSchemaIdMap = await buildObjectSchemaMap(verbose);
        for (let j = 0; j < obj.items.length; j++) {
          let object_type = obj.items[j].object_type;
          let object_schema_uri = objectTypeToSchemaIdMap[object_type];

          const validator = ajv.getSchema(object_schema_uri);
          const valid = validator(obj.items[j]);

          if (!valid) {
            console.log(`\n\tXX INVALID DUE TO ERRORS:`);
            console.log(
              `\n ${obj.file_type} at item: [${j}] - ${obj.items[j].id}`
            );
            console.log(validator.errors);
            failOnTest(
              test,
              `OCF file ${ocf_paths[i]} failed: ${JSON.stringify(validator.errors)}`
            );
            return false;
          }
        }
        if (verbose) console.log("\t** VALID OCF **");
      }
    }

    if (manifestObj) {
      if (verbose) {
        console.log(
          "\n--- Validate package extensions (OCIP-0001) ---------------"
        );
      }
      const extensionResult = await validatePackageExtensions(
        manifestObj,
        path,
        {
          mode: "standard",
          verbose,
          ajv,
          ocfObjectIndex: buildOcfObjectIndex(parsedOcfByPath),
          ocfParsedByPath: parsedOcfByPath,
          registryPath:
            extensionOptions.registryPath ??
            join(REPO_ROOT, "registry.json"),
          registryRoot: extensionOptions.registryRoot ?? REPO_ROOT,
        }
      );
      const extensionErrors = extensionResult.issues.filter(
        (issue) => issue.level === "error"
      );
      if (extensionErrors.length > 0) {
        if (verbose) {
          console.log("\n\tXX PACKAGE EXTENSION VALIDATION ERRORS:");
          for (const issue of extensionErrors) {
            console.log(`\t- [${issue.code}] ${issue.message}`);
          }
        }
        failOnTest(test, "OCF package extension validation failed");
        return false;
      }
    }

    if (verbose) {
      console.log("\n\t** ALL FILES VALID OCF **");
    }
    return true;
  } catch (e) {
    failOnTest(test, `OCF Validation failed: ${e.message}`);
    if (verbose) {
      console.log("\n\tXX\tFAILURE DUE TO ERRORS:");
      console.log(
        `\t\tOCF Schema Validations failed due to error: ${e.message}`
      );
    }
    return false;
  }
}
