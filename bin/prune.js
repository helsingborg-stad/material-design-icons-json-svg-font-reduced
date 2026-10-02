#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PACKAGES = [
  '@helsingborg-stad/material-design-icons-json-svg-font-reduced',
  '@helsingborg-stad/material-design-icons-json-svg-font',
];
const FORMATS = ['svg', 'ttf', 'otf', 'woff', 'woff2'];
const KEYS = ['variants', 'weights', 'formats', 'symbols', 'staticFonts', 'variableFonts', 'dryRun'];

function readArray(file) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new Error(`Expected a JSON array at ${file}`);
  return value;
}

function selection(config, key, allowed) {
  if (!(key in config)) return allowed;
  const value = config[key];
  if (!Array.isArray(value) || value.length === 0 || value.some(item => !allowed.includes(item))) {
    throw new Error(`Material Symbols ${key} must be a non-empty array of known values.`);
  }
  return [...new Set(value)];
}

function flag(config, key, fallback) {
  if (!(key in config)) return fallback;
  if (typeof config[key] !== 'boolean') throw new Error(`Material Symbols ${key} must be a boolean.`);
  return config[key];
}

function prune(root, config) {
  if (!config || Array.isArray(config) || typeof config !== 'object') throw new Error('Material Symbols config must be an object.');
  for (const key of Object.keys(config)) if (!KEYS.includes(key)) throw new Error(`Unknown Material Symbols option: ${key}`);
  if (!Object.keys(config).some(key => key !== 'dryRun')) throw new Error('Specify at least one Material Symbols selection before pruning.');

  const variants = new Set(selection(config, 'variants', readArray(path.join(root, 'variants.json'))));
  const weights = new Set(selection(config, 'weights', readArray(path.join(root, 'weight.json'))));
  const symbols = new Set(selection(config, 'symbols', readArray(path.join(root, 'symbols.json'))));
  const formats = new Set(selection(config, 'formats', FORMATS));
  const staticFonts = flag(config, 'staticFonts', true);
  const variableFonts = flag(config, 'variableFonts', true);
  const dryRun = flag(config, 'dryRun', false);
  if (!formats.has('svg') && !(staticFonts && [...formats].some(format => format !== 'svg')) &&
      !(variableFonts && ['ttf', 'woff', 'woff2'].some(format => formats.has(format)))) {
    throw new Error('This selection would keep no assets.');
  }
  const result = {files: 0, bytes: 0, dryRun};
  const entries = directory => fs.existsSync(directory) && fs.lstatSync(directory).isDirectory()
    ? fs.readdirSync(directory, {withFileTypes: true}) : [];
  const remove = file => { result.files++; result.bytes += fs.statSync(file).size; if (!dryRun) fs.unlinkSync(file); };
  const removeEmpty = directory => { if (!dryRun && fs.existsSync(directory) && fs.readdirSync(directory).length === 0) fs.rmdirSync(directory); };

  for (const variant of readArray(path.join(root, 'variants.json'))) {
    for (const weight of readArray(path.join(root, 'weight.json'))) {
      const directory = path.join(root, variant, String(weight));
      for (const entry of entries(directory)) {
        if (entry.isFile() && entry.name.endsWith('.svg') && !(formats.has('svg') && variants.has(variant) && weights.has(weight) && symbols.has(entry.name.slice(0, -4)))) remove(path.join(directory, entry.name));
      }
      removeEmpty(directory);
    }
    removeEmpty(path.join(root, variant));

    const fontDirectory = path.join(root, 'fonts', variant);
    for (const entry of entries(fontDirectory)) {
      if (!entry.isFile() || !entry.name.startsWith('material-symbols-variable.')) continue;
      const format = path.extname(entry.name).slice(1);
      if (!(variableFonts && variants.has(variant) && formats.has(format))) remove(path.join(fontDirectory, entry.name));
    }
    removeEmpty(fontDirectory);
  }
  removeEmpty(path.join(root, 'fonts'));
  return result;
}

if (require.main === module) {
  try {
    const project = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    const config = PACKAGES.map(packageName => project[packageName]).find(value => value !== undefined);
    if (config === undefined) throw new Error(`Add a ${PACKAGES[0]} selection to your package.json.`);
    const result = prune(path.resolve(__dirname, '..'), config);
    console.log(`Material Symbols: ${result.dryRun ? 'Would remove' : 'Removed'} ${result.files} files (${(result.bytes / 1048576).toFixed(1)} MiB).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {prune};
