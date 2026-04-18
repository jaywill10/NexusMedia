import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCHEMA_DIR = path.resolve(__dirname, '..', 'base44', 'entities');

function stripJsonc(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/,\s*([}\]])/g, '$1');
}

function loadSchemas() {
  const out = {};
  if (!fs.existsSync(SCHEMA_DIR)) return out;
  for (const file of fs.readdirSync(SCHEMA_DIR)) {
    if (!file.endsWith('.jsonc')) continue;
    const name = file.replace(/\.jsonc$/, '');
    const raw = fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8');
    try {
      out[name] = JSON.parse(stripJsonc(raw));
    } catch (err) {
      console.warn(`schema ${name} failed to parse:`, err.message);
    }
  }
  return out;
}

export const SCHEMAS = loadSchemas();
export const ENTITIES = Object.keys(SCHEMAS);
