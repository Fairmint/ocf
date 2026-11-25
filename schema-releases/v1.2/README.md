# OCF JSON Schema bundle — release 1.2.x (read-only)

Vendored snapshot for per-minor validation (OCIP-0001 §2.2). **Do not edit** these files.

| Field | Value |
| ----- | ----- |
| Source tag | [`v1.2.0`](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/releases/tag/v1.2.0) (latest published 1.2 patch on upstream at import time) |
| Tag commit | `9f987b48e288703ff2cd6c4534f7769bb04e724a` |
| Tree SHA-256 | `7a39a07ec697ab5c9d1a6603f58649c8495f4fe2611c6756c32d3b770f90cda1` |

Imported with:

```bash
git archive v1.2.0 schema | tar -x
```

Regenerate the tree checksum after any re-import:

```bash
find schema-releases/v1.2 -type f ! -name README.md | sort | xargs sha256sum | sha256sum
```
