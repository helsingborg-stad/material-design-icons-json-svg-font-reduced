# Reduced Material Symbols assets

Composer package with all Material Symbols icons in this fixed profile:

- SVG: `outlined`, `rounded` and `sharp` at weights `200`, `400` and `600`.
- Fonts: variable `woff2` for `outlined`, `rounded` and `sharp` only.
- JSON: `symbols.json`, `variants.json`, `weight.json`, `metadata.json`, `reduction.json` and source provenance in `source.json`.

No filled SVG variants, static fonts, TTF, WOFF or OTF files are included. The variable fonts retain their upstream axes and all glyphs.

## Install with Composer

Register this repository in Packagist, then install a tagged version:

```sh
composer require helsingborg-stad/material-design-icons-json-svg-font-reduced
```

Assets are installed under `vendor/helsingborg-stad/material-design-icons-json-svg-font-reduced/`.

## Automated releases

The sync workflow checks the source package daily and can also be run manually. It generates the assets in the repository root, verifies the fixed profile, commits changed output, tags it with the source package version, and creates a GitHub Release.

If `helsingborg-stad/material-design-icons-json-svg-font` is private, add a repository secret named `MATERIAL_SYMBOLS_READ_TOKEN` with read access to that repository.

## Local verification

Clone the source package beside this repository (or specify its path), then run:

```sh
node scripts/build.mjs --source ../material-design-icons-json-svg-font --output /tmp/material-symbols-reduced
node scripts/verify.mjs /tmp/material-symbols-reduced
```
