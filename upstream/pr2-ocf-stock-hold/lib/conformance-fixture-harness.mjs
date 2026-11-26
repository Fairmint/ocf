import fs from "fs";
import { cpSync, mkdtempSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { tmpdir } from "os";

/**
 * Copy every file under `overlayDir` onto `packageRoot`, preserving relative paths.
 */
export function applyOverlay(packageRoot, overlayDir) {
  if (!fs.existsSync(overlayDir)) {
    return;
  }
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const src = join(dir, name);
      const rel = relative(overlayDir, src);
      const dest = join(packageRoot, rel);
      if (statSync(src).isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        walk(src);
      } else {
        fs.mkdirSync(join(dest, ".."), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    }
  };
  walk(overlayDir);
}

/**
 * @param {string} fixtureRoot
 * @param {string[]} overlayRelativePaths
 * @returns {string}
 */
export function materializeFixturePackage(fixtureRoot, overlayRelativePaths = []) {
  const baseDir = join(fixtureRoot, "base");
  const packageRoot = mkdtempSync(join(tmpdir(), "ocf-ext-conformance-"));
  cpSync(baseDir, packageRoot, { recursive: true });
  for (const rel of overlayRelativePaths) {
    applyOverlay(packageRoot, join(fixtureRoot, rel));
  }
  return packageRoot;
}

export function removeMaterializedPackage(packageRoot) {
  if (packageRoot && fs.existsSync(packageRoot)) {
    fs.rmSync(packageRoot, { recursive: true, force: true });
  }
}