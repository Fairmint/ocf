#!/usr/bin/env node
import {
  loadRegistryIndex,
  validateRegistryAgainstSchema,
  assertRegistryInvariants,
  assertConformanceDirectoriesExist,
} from "./registry-index.mjs";
import { runRegisteredExtensionConformance } from "./run-extension-conformance.mjs";

const { registry, repoRoot } = await loadRegistryIndex();
const schemaResult = await validateRegistryAgainstSchema(registry, repoRoot);
if (!schemaResult.ok) {
  console.error("registry.json failed schema validation", schemaResult.errors);
  process.exit(1);
}
const invariantViolations = assertRegistryInvariants(registry, repoRoot);
if (invariantViolations.length > 0) {
  console.error("registry invariants failed", invariantViolations);
  process.exit(1);
}
const missing = assertConformanceDirectoriesExist(registry, repoRoot);
if (missing.length > 0) {
  console.error("Missing conformance-fixtures/base for:", missing.join(", "));
  process.exit(1);
}
const conformance = await runRegisteredExtensionConformance();
if (!conformance.ok) {
  console.error("Extension conformance failed", conformance.violations, conformance.outcomes);
  process.exit(1);
}
console.log(
  `OK registry v${registry.version}, ${registry.profiles.length} profile(s), ${conformance.ranCases} case(s)`
);