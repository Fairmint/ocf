/**
 * OCF package `ocf_version` resolution (OCIP-0001 §2.2).
 * @readonly
 */
export const IMPLEMENTED_OCF_VERSION = "1.3.0-alpha+main";

/**
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number } | null}
 */
export function parseOcfSemverCore(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number} negative if a < b, positive if a > b, 0 if equal
 */
export function compareOcfSemverCore(a, b) {
  const av = parseOcfSemverCore(a);
  const bv = parseOcfSemverCore(b);
  if (!av || !bv) {
    return NaN;
  }
  if (av.major !== bv.major) {
    return av.major - bv.major;
  }
  if (av.minor !== bv.minor) {
    return av.minor - bv.minor;
  }
  return av.patch - bv.patch;
}

/**
 * Which OCF JSON Schema bundle to use for validating a package.
 * This repository ships one bundle (the current 1.3 tree). Older 1.x minors
 * MUST be validated against the published schema release for that minor;
 * reference validators MAY load those releases by tag when integrated.
 *
 * @param {string} ocfVersion manifest `ocf_version`
 */
export function resolveOcfSchemaBundle(ocfVersion) {
  const declared = parseOcfSemverCore(ocfVersion);
  const implemented = parseOcfSemverCore(IMPLEMENTED_OCF_VERSION);
  if (!declared || !implemented) {
    return {
      ok: false,
      reason: "unparseable",
      message: `Cannot parse ocf_version: ${JSON.stringify(ocfVersion)}`,
    };
  }
  if (declared.major !== 1) {
    return {
      ok: false,
      reason: "unsupported_major",
      message: `OCF major version ${declared.major} is not supported (only 1.x)`,
    };
  }
  if (declared.minor > implemented.minor) {
    return {
      ok: false,
      reason: "newer_minor_than_implemented",
      message: `Package declares OCF ${declared.minor}.${declared.patch} but validator implements up to ${implemented.minor}.x (${IMPLEMENTED_OCF_VERSION})`,
    };
  }
  const loadFromRelease =
    declared.minor < implemented.minor ? `v1.${declared.minor}.0` : null;
  return {
    ok: true,
    declaredMinor: declared.minor,
    implementedMinor: implemented.minor,
    bundle: "local",
    loadFromRelease,
    message: loadFromRelease
      ? `Declared OCF 1.${declared.minor}.x: load schema bundle from published release ${loadFromRelease}; this reference build validates with in-repo schemas when declared minor <= ${implemented.minor}.`
      : `Declared OCF matches in-repo bundle minor ${implemented.minor}.`,
  };
}
