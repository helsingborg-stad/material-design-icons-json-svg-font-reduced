#!/usr/bin/env node
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(process.argv[2] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const profile = JSON.parse(readFileSync(path.join(root, 'reduction.json'), 'utf8'));
const symbols = JSON.parse(readFileSync(path.join(root, 'symbols.json'), 'utf8'));
const variants = JSON.parse(readFileSync(path.join(root, 'variants.json'), 'utf8'));
const weights = JSON.parse(readFileSync(path.join(root, 'weight.json'), 'utf8'));
const metadata = JSON.parse(readFileSync(path.join(root, 'metadata.json'), 'utf8'));

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

ensure(JSON.stringify(variants) === JSON.stringify(profile.variants), 'variants.json does not match reduction.json.');
ensure(JSON.stringify(weights) === JSON.stringify(profile.weights), 'weight.json does not match reduction.json.');
ensure(symbols.length > 0, 'symbols.json must contain icons.');
ensure(metadata.reduction && JSON.stringify(metadata.reduction) === JSON.stringify(profile), 'metadata.json lacks the expected reduction manifest.');

for (const variant of profile.variants) {
  for (const weight of profile.weights) {
    const directory = path.join(root, variant, String(weight));
    ensure(existsSync(directory), `Missing ${directory}.`);
    const svgs = readdirSync(directory).filter(name => name.endsWith('.svg'));
    ensure(svgs.length === symbols.length, `${directory} has ${svgs.length} SVGs; expected ${symbols.length}.`);
  }
  ensure(existsSync(path.join(root, 'fonts', variant, 'material-symbols-variable.woff2')),
    `Missing variable WOFF2 for ${variant}.`);
}

for (const unwanted of ['filled', 'rounded-filled', 'sharp-filled']) {
  ensure(!existsSync(path.join(root, unwanted)), `Unexpected ${unwanted} SVG directory.`);
  ensure(!existsSync(path.join(root, 'fonts', unwanted)), `Unexpected ${unwanted} font directory.`);
}

console.log(`Verified ${symbols.length} icons in ${profile.variants.length * profile.weights.length} SVG sets.`);
