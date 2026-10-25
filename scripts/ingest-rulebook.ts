// pnpm ingest <gameId> [--force]   extract sections into data/rulebooks/<gameId>.sections.json
// pnpm ingest <gameId> --load      load the reviewed file (replaces that rulebook's sections)
// docs/ARCHITECTURE.md → Rules assistant → Ingestion.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { getGame } from '../packages/core/src/games/registry';

import { loadLocalEnv, ROOT } from './lib/local-env.mjs';
import { readPdfText } from './lib/pdf-text';
import { ReviewFileSchema, toLoadArgs, type ReviewFile } from './lib/review-file';
import { RULEBOOK_LAYOUTS } from './lib/rulebook-layouts';
import { splitSections } from './lib/sections';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const gameId = args.find((arg) => !arg.startsWith('--'));
const game = gameId ? getGame(gameId) : undefined;
if (!game) fail('Usage: pnpm ingest <patchwork|azul|harmonies|dorfromantik> [--load] [--force]');

const pdfPath = join(ROOT, 'data/rulebooks', `${game.id}.pdf`);
const reviewPath = join(ROOT, 'data/rulebooks', `${game.id}.sections.json`);

if (args.includes('--load')) {
  if (!existsSync(reviewPath)) fail(`No review file yet. Run pnpm ingest ${game.id} first.`);
  const parsed = ReviewFileSchema.safeParse(JSON.parse(readFileSync(reviewPath, 'utf8')));
  if (!parsed.success) fail(`${reviewPath} is invalid:\n${z.prettifyError(parsed.error)}`);
  if (parsed.data.gameId !== game.id) fail(`${reviewPath} is for ${parsed.data.gameId}.`);

  await loadLocalEnv();
  const env = z
    .object({ SUPABASE_URL: z.url(), SUPABASE_SERVICE_ROLE_KEY: z.string().min(1) })
    .parse(process.env);
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.rpc('replace_rulebook', toLoadArgs(parsed.data));
  if (error) fail(`Loading failed: ${error.message}`);
  console.log(`Loaded ${parsed.data.sections.length} sections for ${game.name}.`);
  process.exit(0);
}

if (!existsSync(pdfPath)) {
  fail(`Missing ${pdfPath}. Download the official rulebook (docs/DATA_ASSETS.md → Rulebooks).`);
}
if (existsSync(reviewPath) && !args.includes('--force')) {
  fail(`${reviewPath} exists and may hold review edits. Pass --force to extract it again.`);
}

const pdf = readFileSync(pdfPath);
const text = await readPdfText(new Uint8Array(pdf));
if (text.hasOutline) console.warn('The PDF has an outline; sections still come from headings.');
const sections = splitSections(text.runs, text.pages, RULEBOOK_LAYOUTS[game.id]);
const file: ReviewFile = {
  gameId: game.id,
  sourceVersion: createHash('sha256').update(pdf).digest('hex').slice(0, 16),
  rulebook: {
    edition: game.edition,
    title: `${game.name} (${game.edition})`,
    publisherUrl: game.rulebook.publisherUrl,
  },
  sections,
};
writeFileSync(reviewPath, `${JSON.stringify(ReviewFileSchema.parse(file), null, 2)}\n`);

for (const s of sections) {
  const indent = s.parentKey ? '    ' : '';
  const pages =
    s.pdfPageStart === s.pdfPageEnd ? s.pdfPageStart : `${s.pdfPageStart}-${s.pdfPageEnd}`;
  console.log(
    `${indent}${s.key} ${s.number ? `${s.number}. ` : ''}${s.title}  [pdf ${pages}, printed ${s.printedPages ?? 'none'}, ${s.body.length} chars]`,
  );
}
console.log(`\nWrote ${sections.length} sections to ${reviewPath}.`);
console.log(`Review titles, pages and bodies there, then run pnpm ingest ${game.id} --load.`);
