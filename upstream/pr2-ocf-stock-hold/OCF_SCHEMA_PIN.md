# Pinned OCF JSON Schema bundle

Conformance tests validate sample packages against the coalition
[Open-Cap-Format-OCF](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF) repository at the
commit recorded in [`vendor/ocf-schema-pin.json`](./vendor/ocf-schema-pin.json).

## Pin

| Field | Value |
| ----- | ----- |
| Repository | `Open-Cap-Table-Coalition/Open-Cap-Format-OCF` |
| Commit | `fd260852ebd3d3e1a3183f8c97ae3f645dc9f0d6` (`main` at pin time) |

## Overlay (OCIP-0001 manifest fields)

The pinned tree does not yet include manifest `profiles`, `profile_files`, `vendor_extensions`, and
`vendor_extension_files`. Before tests run, `scripts/fetch-ocf-schemas.mjs` copies the pending schemas from
[`vendor/ocip-pending/`](./vendor/ocip-pending/) into the fetched OCF tree. This matches
[OCIP-0001 §4](https://github.com/Open-Cap-Table-Coalition/Technical-Working-Group/blob/main/OCIP/proposals/0001-ocf-extension-architecture.md)
and will be removed once coalition `main` (or a release tag) includes those fields natively.

## Fetching locally

```bash
node scripts/fetch-ocf-schemas.mjs
```

Output directory: `vendor/ocf-schema/` (gitignored). CI and `npm test` invoke the fetch script via
`package.json` `prepare`.