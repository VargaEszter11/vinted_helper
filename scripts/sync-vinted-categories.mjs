import { readFileSync, writeFileSync } from 'node:fs';

const header = `/** Vinted-style inventory categories for saved items (mirrors backend/src/lib/vinted-categories.js). */

export type VintedCategoryEntry = {
  id: string;
  label: string;
  group: string;
  section: string;
  path: string;
};

/** Stored category id on an item. */
export type ItemVintedCategory = string;

`;

let body = readFileSync('backend/src/lib/vinted-categories.js', 'utf8');
body = body.replace(/^\/\*\* Vinted-style inventory categories \(group > section > leaf\)\. \*\/\n\n/, '');
body = body.replace('const slug = (text) =>', 'const slug = (text: string) =>');
body = body.replace(
  'function buildCategories() {',
  'function buildCategories(): VintedCategoryEntry[] {',
);
body = body.replace(
  'export function isValidVintedCategoryId(id) {',
  'export function isValidVintedCategoryId(id: string) {',
);
body = body.replace(
  'export function vintedCategoryById(id) {',
  'export function vintedCategoryById(id: string) {',
);
body = body.replace(
  'export function searchVintedCategories(query, limit = 80) {',
  'export function searchVintedCategories(query: string, limit = 80) {',
);
writeFileSync('frontend/src/lib/item-vinted-categories.ts', header + body);
