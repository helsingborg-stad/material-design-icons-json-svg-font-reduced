#!/usr/bin/env node
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetJson = ['symbols.json', 'variants.json', 'weight.json', 'metadata.json'];
const assetDirectories = ['outlined', 'rounded', 'sharp', 'filled', 'rounded-filled', 'sharp-filled', 'fonts'];

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function copy(source, target) {
  mkdirSync(path.dirname(target), {recursive: true});
  cpSync(source, target, {recursive: true});
}

const source = path.resolve(option('--source', path.join(root, 'upstream')));
const output = path.resolve(option('--output', root));
const profile = readJson(path.join(root, 'reduction.json'));

ensure(existsSync(path.join(source, 'symbols.json')), `Missing Material Symbols source at ${source}.`);
ensure(source !== output, 'The source and output directories must differ.');
ensure(profile.staticFonts === false && profile.variableFonts === true,
  'This package is intentionally configured for variable WOFF2 fonts only.');
ensure(JSON.stringify(profile.variants) === JSON.stringify(['outlined', 'rounded', 'sharp']),
  'variants must be outlined, rounded and sharp.');
ensure(JSON.stringify(profile.weights) === JSON.stringify([200, 400, 600]),
  'weights must be 200, 400 and 600.');
ensure(JSON.stringify(profile.formats) === JSON.stringify(['svg', 'woff2']),
  'formats must be svg and woff2.');

for (const name of assetDirectories) rmSync(path.join(output, name), {recursive: true, force: true});
for (const name of assetJson) rmSync(path.join(output, name), {force: true});

const sourceSymbols = readJson(path.join(source, 'symbols.json'));
const sourceMetadata = readJson(path.join(source, 'metadata.json'));

for (const variant of profile.variants) {
  for (const weight of profile.weights) {
    copy(path.join(source, variant, String(weight)), path.join(output, variant, String(weight)));
  }
  copy(
    path.join(source, 'fonts', variant, 'material-symbols-variable.woff2'),
    path.join(output, 'fonts', variant, 'material-symbols-variable.woff2'),
  );
}

writeFileSync(path.join(output, 'symbols.json'), `${JSON.stringify(sourceSymbols, null, 2)}\n`);
writeFileSync(path.join(output, 'variants.json'), `${JSON.stringify(profile.variants, null, 2)}\n`);
writeFileSync(path.join(output, 'weight.json'), `${JSON.stringify(profile.weights, null, 2)}\n`);
writeFileSync(path.join(output, 'reduction.json'), `${JSON.stringify(profile, null, 2)}\n`);

const metadata = {
  ...sourceMetadata,
  axes: Object.fromEntries(profile.variants.map(variant => [variant, sourceMetadata.axes[variant]])),
  icons: Object.fromEntries(sourceSymbols.map(symbol => {
    const sourceIcon = sourceMetadata.icons[symbol] ?? {};
    const variants = Object.fromEntries(profile.variants.flatMap(variant => {
      const record = sourceIcon[variant];
      if (!record) return [];
      const weights = record.weights.filter(weight => profile.weights.includes(weight));
      return weights.length === 0 ? [] : [[variant, {...record, weights}]];
    }));
    return [symbol, variants];
  })),
  reduction: profile,
};
writeFileSync(path.join(output, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);

const sourcePackage = readJson(path.join(source, 'package.json'));
writeFileSync(path.join(output, 'source.json'), `${JSON.stringify({
  package: sourcePackage.name,
  version: sourcePackage.version,
  repository: sourcePackage.repository?.url,
  sourceCommit: sourceMetadata.sourceCommit,
}, null, 2)}\n`);

for (const name of ['LICENSE', 'NOTICE']) {
  if (existsSync(path.join(source, name))) copy(path.join(source, name), path.join(output, name));
}

const files = profile.variants.flatMap(variant => profile.weights.map(weight =>
  readdirSync(path.join(output, variant, String(weight))).filter(name => name.endsWith('.svg')).length,
));
const bytes = profile.variants.reduce((total, variant) =>
  total + statSync(path.join(output, 'fonts', variant, 'material-symbols-variable.woff2')).size, 0);
console.log(`Built ${files.reduce((total, count) => total + count, 0)} SVGs and ${(bytes / 1048576).toFixed(1)} MiB of variable WOFF2 fonts.`);
