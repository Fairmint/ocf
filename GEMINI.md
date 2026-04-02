# GEMINI.md

This document provides guidance for Gemini when working with the Open Cap Table Format (OCF) repository.

## Project Overview

OCF (Open Cap Table Format) is a JSON Schema-based data standard for company capitalization tables. The project defines schemas for cap table objects (stakeholders, transactions, stock classes, etc.) and provides validation and documentation generation tools written in TypeScript and Node.js (using ESM).

## Key Files & Directories

| Path                    | Description                                                                  |
| ----------------------- | ---------------------------------------------------------------------------- |
| `schema/`               | Canonical JSON Schema definitions.                                           |
| `schema/objects/`       | Core business object schemas (e.g., Stakeholder, StockClass).                |
| `schema/objects/transactions/` | Schemas for all transaction types.                                     |
| `schema/enums/`         | Enum definitions like `ObjectType` and `FileType`.                           |
| `schema/primitives/`    | Abstract base schemas for inheritance (`allOf`).                             |
| `samples/`              | Example `.ocf.json` files that correspond to schemas. Used for testing.      |
| `utils/validate.mjs`    | Core validation logic using AJV.                                             |
| `utils/generate-docs/`  | Scripts for generating Markdown documentation from schemas.                  |
| `docs/schema_markdown/` | The output directory for generated schema documentation.                     |
| `package.json`          | Defines all `npm` scripts for testing, validation, and other tasks.          |

## Common Commands

Use these `npm` scripts to develop and validate changes.

### Validation

- **Validate schema files:** `npm run schema:validate-ocf-file-schemas`
  - Checks that all `*.schema.json` files are valid JSON Schema.
- **Validate example files:** `npm run schema:validate-example-ocf-files`
  - Validates all files in `samples/` against their corresponding schemas.
- **Check for missing samples:** `npm run schema:validate-all-objects-have-samples`
  - Ensures every object type has a corresponding sample file.

### Testing

- **Run all tests:** `npm test`
  - Executes the full Jest test suite.
- **Run a single test file:** `npm test -- <path_to_test_file>`
  - Example: `npm test -- utils/schema-utils/PathTools.test.ts`

### Linting & Formatting

- **Check formatting:** `npm run lint`
- **Fix formatting:** `npm run lint:fix`
  - The project uses Prettier. `lint-staged` is also configured.

### Documentation

- **Generate docs:** `npm run docs:generate`
  - Rebuilds all markdown documentation in `docs/schema_markdown/` from the schemas.

## Core Workflows

### 1. Modifying an Existing Schema

1.  **Edit the schema file** in `schema/`.
2.  **Run validation** to ensure the schema itself is valid: `npm run schema:validate-ocf-file-schemas`.
3.  **Update corresponding samples** in `samples/` to reflect the changes.
4.  **Run example validation:** `npm run schema:validate-example-ocf-files`.
5.  **Run tests:** `npm test`.
6.  **Regenerate documentation:** `npm run docs:generate`. The pre-commit hook will also run this.

### 2. Adding a New Object or Transaction Schema

1.  **Create the new schema file** in the appropriate `schema/` subdirectory (e.g., `schema/objects/transactions/`).
2.  **Inherit from a base schema** using `allOf`. Most objects inherit from `schema/primitives/objects/Object.schema.json`. Transactions have a deeper inheritance chain.
3.  **Define a `const` value for `object_type`**. This is the discriminated union key.
4.  **Add the new `object_type` value** to the `enum` array in `schema/enums/ObjectType.schema.json`.
5.  **Create at least one sample instance** of the new object in a relevant file within the `samples/` directory.
6.  **Verify sample coverage:** `npm run schema:validate-all-objects-have-samples`.
7.  **Run all validation and tests:**
    - `npm run schema:validate-ocf-file-schemas`
    - `npm run schema:validate-example-ocf-files`
    - `npm test`
8.  **Generate documentation:** `npm run docs:generate`.

## Architecture & Key Concepts

-   **Schema Inheritance:** The project uses `allOf` and `$ref` to compose schemas from base primitives. This is a core pattern.
-   **Validation (`utils/validate.mjs`):** AJV is used to validate OCF files. It uses the `file_type` and `object_type` properties as discriminated unions to select the correct schema for validation.
-   **Pre-commit Hooks:** Husky is configured to run `schema:enforce-copyright-notices` and `docs:generate` before a commit. This means documentation is automatically kept in sync with schema changes.
-   **Node.js Environment:** The tooling uses TypeScript with native ECMAScript Modules (ESM). File imports must include the file extension (e.g., `.ts`, `.mjs`).
