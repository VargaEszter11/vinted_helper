import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';

import { config } from '../config.js';
import { pool } from '../db.js';
import { photoFileInfo } from './photo-files.js';

// A dump is NDJSON (one JSON object per line):
//   {"type":"header","format":1,...}
//   {"type":"row","table":"items","row":{...}}   (parents before children)
//   {"type":"photo","path":"<item id>/<photo id>.jpg","data":"<base64>"}
//   {"type":"end"}
// Add new tables here, parents first.
const TABLES = ['users', 'bundles', 'items', 'item_photos', 'item_status_history'];
const ORDER_BY = { item_status_history: 'order by id' };

const FORMAT = 1;
const BATCH_SIZE = 500;
const PHOTO_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;
const STAGING_PREFIX = '.import-';

const line = (value) => `${JSON.stringify(value)}\n`;

/**
 * Splits a byte stream into text lines. It reads only as fast as the caller consumes,
 * so a huge upload is never held in memory (a line is at most one photo).
 */
export async function* linesOf(stream) {
  const decoder = new StringDecoder('utf8');
  let pending = '';
  for await (const chunk of stream) {
    pending += decoder.write(chunk);
    let end;
    while ((end = pending.indexOf('\n')) !== -1) {
      yield pending.slice(0, end);
      pending = pending.slice(end + 1);
    }
  }
  pending += decoder.end();
  if (pending !== '') yield pending;
}

/** Yields the whole database and every photo as dump lines. */
export async function* dumpLines() {
  yield line({ type: 'header', format: FORMAT, exported_at: new Date().toISOString(), tables: TABLES });

  for (const table of TABLES) {
    const { rows } = await pool.query(
      `select row_to_json(t) as row from ${table} t ${ORDER_BY[table] ?? ''}`,
    );
    for (const { row } of rows) yield line({ type: 'row', table, row });
  }

  const { rows: photos } = await pool.query('select storage_path from item_photos');
  for (const { storage_path } of photos) {
    const info = await photoFileInfo(storage_path);
    if (!info) continue;
    const data = (await readFile(info.file)).toString('base64');
    yield line({ type: 'photo', path: storage_path, data });
  }

  yield line({ type: 'end' });
}

export async function databaseStats() {
  const { rows } = await pool.query(`
    select
      (select count(*) from users)::int as users,
      (select count(*) from items)::int as items,
      (select count(*) from bundles)::int as bundles,
      (select count(*) from item_photos)::int as photos`);
  return rows[0];
}

/** Columns that can be written: the table's own, minus identity columns. */
async function writableColumns(client) {
  const { rows } = await client.query(
    `select table_name, column_name from information_schema.columns
     where table_schema = 'public' and table_name = any($1) and is_identity = 'NO' and is_generated = 'NEVER'`,
    [TABLES],
  );
  const columns = Object.fromEntries(TABLES.map((table) => [table, new Set()]));
  for (const row of rows) columns[row.table_name].add(row.column_name);
  return columns;
}

async function insertRows(client, table, rows, writable) {
  if (rows.length === 0) return;
  // Column names come from the dump, so only those that really exist are used.
  const columns = Object.keys(rows[0]).filter((column) => writable[table].has(column));
  const list = columns.map((column) => `"${column}"`).join(', ');
  await client.query(
    `insert into ${table} (${list}) select ${list} from jsonb_populate_recordset(null::${table}, $1::jsonb)`,
    [JSON.stringify(rows)],
  );
}

/**
 * Replaces everything (database and photos) with the contents of a dump.
 * All or nothing: on any error the database is left as it was.
 * `lines` is any async iterable of text lines.
 */
export async function importDump(lines) {
  const staging = path.join(config.photoDir, `${STAGING_PREFIX}${randomUUID()}`);
  const client = await pool.connect();
  const counts = { users: 0, bundles: 0, items: 0, photos: 0 };
  let inTransaction = false;
  let sawHeader = false;
  let sawEnd = false;
  let sawAdmin = false;
  let batchTable = null;
  let batch = [];

  try {
    await client.query('begin');
    inTransaction = true;
    const writable = await writableColumns(client);

    const flush = async () => {
      if (batchTable) await insertRows(client, batchTable, batch, writable);
      batch = [];
    };

    for await (const text of lines) {
      if (text.trim() === '') continue;
      let entry;
      try {
        entry = JSON.parse(text);
      } catch {
        throw new Error('The file is not a valid export (a line is not JSON).');
      }

      if (!sawHeader) {
        if (entry.type !== 'header' || entry.format !== FORMAT) {
          throw new Error('The file is not an export from this app, or is from a newer version.');
        }
        sawHeader = true;
        // Children cascade, so this empties every table. Imported history gets fresh ids.
        await client.query(`truncate ${TABLES.join(', ')} restart identity cascade`);
        // The dump already holds each item's status dates and history; do not re-create them.
        await client.query('alter table items disable trigger user');
        continue;
      }

      if (entry.type === 'row') {
        if (!TABLES.includes(entry.table) || typeof entry.row !== 'object' || entry.row === null) {
          throw new Error('The file contains an unknown table.');
        }
        if (entry.table !== batchTable || batch.length >= BATCH_SIZE) {
          await flush();
          batchTable = entry.table;
        }
        batch.push(entry.row);
        if (entry.table in counts) counts[entry.table] += 1;
        if (entry.table === 'users' && entry.row.username === config.adminUsername) sawAdmin = true;
      } else if (entry.type === 'photo') {
        if (!PHOTO_PATH.test(entry.path) || typeof entry.data !== 'string') {
          throw new Error('The file contains an invalid photo.');
        }
        await flush();
        const file = path.join(staging, ...entry.path.split('/'));
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, Buffer.from(entry.data, 'base64'));
        counts.photos += 1;
      } else if (entry.type === 'end') {
        sawEnd = true;
      }
    }

    if (!sawHeader) throw new Error('The file is empty.');
    if (!sawEnd) throw new Error('The file is incomplete (the upload was cut off).');
    await flush();
    if (!sawAdmin) {
      throw new Error(
        `The export has no "${config.adminUsername}" account, so nobody could manage the server afterwards.`,
      );
    }

    await client.query('alter table items enable trigger user');
    await client.query('commit');
    inTransaction = false;
  } catch (error) {
    if (inTransaction) await client.query('rollback').catch(() => {});
    await rm(staging, { recursive: true, force: true });
    throw error;
  } finally {
    client.release();
  }

  await swapInPhotos(staging);
  return counts;
}

/** Replaces the photo directory's contents with the staged photos. */
async function swapInPhotos(staging) {
  const stagingName = path.basename(staging);
  for (const name of await readdir(config.photoDir)) {
    if (name !== stagingName) await rm(path.join(config.photoDir, name), { recursive: true, force: true });
  }
  const staged = await readdir(staging).catch(() => []);
  for (const name of staged) await rename(path.join(staging, name), path.join(config.photoDir, name));
  await rm(staging, { recursive: true, force: true });
}
