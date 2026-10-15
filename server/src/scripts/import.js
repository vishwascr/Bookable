// Phase 1: stream Books.csv into MongoDB.
// Usage: npm run import  (optionally CSV_PATH=/path/to/Books.csv)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse';
import mongoose from 'mongoose';
import { connect } from '../db.js';
import Book from '../models/Book.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = process.env.CSV_PATH || path.resolve(__dirname, '../../../Books.csv');
const BATCH = 5000;

function clean(row) {
  const year = parseInt(row['Year-Of-Publication'], 10);
  return {
    isbn: String(row.ISBN || '').trim(),
    title: String(row['Book-Title'] || '').trim(),
    author: String(row['Book-Author'] || '').trim(),
    // Year 0 / future years are data errors in this dataset -> null
    year: Number.isFinite(year) && year > 0 && year <= 2025 ? year : null,
    publisher: String(row.Publisher || '').trim(),
    imageS: row['Image-URL-S'],
    imageM: row['Image-URL-M'],
    imageL: row['Image-URL-L'],
  };
}

async function main() {
  await connect();
  await Book.deleteMany({});
  await Book.syncIndexes();

  const parser = fs.createReadStream(CSV_PATH).pipe(
    parse({ columns: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true, bom: true })
  );

  let batch = [];
  let total = 0;
  let skipped = 0;
  const seen = new Set();

  const flush = async () => {
    if (!batch.length) return;
    await Book.insertMany(batch, { ordered: false }).catch((e) => {
      skipped += e?.writeErrors?.length || 0;
    });
    total += batch.length;
    batch = [];
    process.stdout.write(`\r[import] ${total} rows processed`);
  };

  for await (const row of parser) {
    const doc = clean(row);
    if (!doc.isbn || !doc.title || seen.has(doc.isbn)) { skipped++; continue; }
    seen.add(doc.isbn);
    batch.push(doc);
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  console.log(`\n[import] done. inserted≈${total}, skipped=${skipped}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
