/**
 * Stable extension validation codes aligned with OCIP-0001 §7 and §6.1 fixtures.
 * @readonly
 */
export const EXTENSION_ERROR_CODES = {
  UNKNOWN_COALITION_PROFILE: "unknown_coalition_profile",
  PROFILE_STATUS_NOT_ACCEPTED: "profile_status_not_accepted",
  PROFILE_SCHEMA_INVALID: "profile_schema_invalid",
  PROFILE_SCHEMA_DRAFT_MISMATCH: "profile_schema_draft_mismatch",
  PROFILE_NAMESPACE_VIOLATION: "profile_namespace_violation",
  PROFILE_DECLARED_NO_FILES: "profile_declared_no_files",
  PROFILE_FILE_WITHOUT_DECLARATION: "profile_file_without_declaration",
  PROFILE_FILE_UNDECLARED: "profile_file_undeclared",
  PROFILE_UNMET_DEPENDENCY: "profile_unmet_dependency",
  PROFILE_DANGLING_REFERENCE: "profile_dangling_reference",
  /** Advisory cap-table field-name heuristic; always emitted as warning (§7). */
  PROFILE_ECONOMIC_VIOLATION: "profile_economic_violation",
  PROFILE_NEWER_MINOR: "profile_newer_minor",
  PROFILE_NEWER_MAJOR: "profile_newer_major",
  PACKAGE_FILE_MISSING: "package_file_missing",
  /** When the manifest entry has no `sha256`; entries with `sha256` skip MD5 verification. */
  PACKAGE_FILE_MD5_MISMATCH: "package_file_md5_mismatch",
  PACKAGE_FILE_SHA256_MISMATCH: "package_file_sha256_mismatch",
  OCF_VERSION_UNSUPPORTED: "ocf_version_unsupported",
  OCF_VERSION_SCHEMA_FALLBACK: "ocf_version_schema_fallback",
  PROFILE_OCF_VERSION_UNSUPPORTED: "profile_ocf_version_unsupported",
};

export const DRAFT_07_META = "http://json-schema.org/draft-07/schema";
