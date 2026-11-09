/**
 * rustam-python/gbrain#15 — file_upload must store one name per visible
 * filename. macOS hands out NFD (`е` + U+0308), Windows NFC (`ё`); before the
 * fix both spellings became distinct storage_path values, so the
 * content_hash + storage_path dedupe stored the same bytes twice.
 *
 * Runs the op handler directly against PGLite + a real `local` backend.
 */

import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGLiteEngine } from '../src/core/pglite-engine.ts';
import { operationsByName } from '../src/core/operations.ts';
import { runFiles } from '../src/commands/files.ts';
import { withEnv } from './helpers/with-env.ts';

let engine: PGLiteEngine;
let storageDir: string;
let fixtureDir: string;

beforeAll(async () => {
  engine = new PGLiteEngine();
  await engine.connect({});
  await engine.initSchema();
  storageDir = mkdtempSync(join(tmpdir(), 'gb-15-storage-'));
  fixtureDir = mkdtempSync(join(process.cwd(), '.gb-15-fixtures-'));
});

afterAll(async () => {
  await engine.disconnect();
  rmSync(storageDir, { recursive: true, force: true });
  rmSync(fixtureDir, { recursive: true, force: true });
});

function ctx() {
  return {
    engine,
    config: { engine: 'pglite', storage: { backend: 'local', bucket: 'b', localPath: storageDir } },
    logger: { info() {}, warn() {}, error() {} },
    dryRun: false,
    remote: false,
    sourceId: 'default',
  } as never;
}

// The same visible name in both normalization forms, each in its own
// directory (APFS would fold them into one file within a directory).
function fixture(dir: string, name: string, bytes: string): string {
  const d = join(fixtureDir, dir);
  mkdirSync(d, { recursive: true });
  const p = join(d, name);
  writeFileSync(p, bytes);
  return p;
}

const NFC = 'ёжик.txt'.normalize('NFC');
const NFD = 'ёжик.txt'.normalize('NFD');

describe('file_upload filename normalization (#15)', () => {
  test('fixture spellings really differ', () => {
    expect(NFC).not.toBe(NFD);
    expect(NFD.normalize('NFC')).toBe(NFC);
  });

  test('NFD and NFC spellings of one name share one storage_path and one row', async () => {
    const op = operationsByName['file_upload'];
    const fromMac = fixture('mac', NFD, 'same bytes');
    const fromWin = fixture('win', NFC, 'same bytes');

    const first = (await op.handler(ctx(), { path: fromMac, page_slug: 'notes/ёжик' })) as {
      status: string; storage_path: string;
    };
    expect(first.status).toBe('uploaded');
    expect(first.storage_path).toBe(`notes/ёжик/${NFC}`);

    const second = (await op.handler(ctx(), { path: fromWin, page_slug: 'notes/ёжик' })) as {
      status: string; storage_path: string;
    };
    expect(second).toEqual({ status: 'already_exists', storage_path: `notes/ёжик/${NFC}` });

    const rows = await engine.executeRaw<{ filename: string; storage_path: string }>(
      `SELECT filename, storage_path FROM files WHERE page_slug = 'notes/ёжик'`,
    );
    expect(rows).toEqual([{ filename: NFC, storage_path: `notes/ёжик/${NFC}` }]);
    expect(existsSync(join(storageDir, 'notes/ёжик', NFC))).toBe(true);
  });

  test('unsorted uploads normalize the filename too', async () => {
    const op = operationsByName['file_upload'];
    const src = fixture('unsorted', NFD, 'unsorted bytes');
    const out = (await op.handler(ctx(), { path: src })) as { storage_path: string };
    expect(out.storage_path.endsWith(`-${NFC}`)).toBe(true);
    expect(out.storage_path.normalize('NFC')).toBe(out.storage_path);
  });

  test('an NFD page_slug builds the same storage_path as its NFC spelling', async () => {
    const op = operationsByName['file_upload'];
    const src = fixture('slug', 'plain.txt', 'slug bytes');
    const a = (await op.handler(ctx(), { path: src, page_slug: 'notes/ёлка'.normalize('NFD') })) as {
      storage_path: string;
    };
    expect(a.storage_path).toBe('notes/ёлка/plain.txt'.normalize('NFC'));
  });
});

// The CLI lanes (`gbrain files upload`, `upload-raw` cloud branch, `sync`)
// build the same storage keys and run the same dedupe, so they must agree
// with the op on one NFC spelling.
describe('files CLI filename normalization (#15)', () => {
  let home: string;

  beforeAll(() => {
    home = mkdtempSync(join(tmpdir(), 'gb-15-home-'));
    mkdirSync(join(home, '.gbrain'), { recursive: true });
    writeFileSync(
      join(home, '.gbrain', 'config.json'),
      JSON.stringify({ engine: 'pglite', storage: { backend: 'local', bucket: 'b', localPath: storageDir } }),
    );
  });

  afterAll(() => rmSync(home, { recursive: true, force: true }));

  async function cli(args: string[]): Promise<string[]> {
    const logs: string[] = [];
    const log = spyOn(console, 'log').mockImplementation((...a: unknown[]) => { logs.push(a.join(' ')); });
    const err = spyOn(console, 'error').mockImplementation(() => {});
    try {
      await withEnv({ GBRAIN_HOME: home, DATABASE_URL: undefined, GBRAIN_DATABASE_URL: undefined }, () =>
        runFiles(engine, args),
      );
    } finally {
      log.mockRestore();
      err.mockRestore();
    }
    return logs;
  }

  async function rowsFor(pageSlug: string) {
    return engine.executeRaw<{ filename: string; storage_path: string }>(
      `SELECT filename, storage_path FROM files WHERE page_slug = $1 ORDER BY storage_path`, [pageSlug],
    );
  }

  test('files upload: NFD then NFC spelling is one upload', async () => {
    await cli(['upload', fixture('cli-mac', NFD, 'cli bytes'), '--page', 'notes/cli'.normalize('NFD')]);
    const second = await cli(['upload', fixture('cli-win', NFC, 'cli bytes'), '--page', 'notes/cli']);
    expect(second.join('\n')).toContain('already uploaded');
    expect(await rowsFor('notes/cli')).toEqual([{ filename: NFC, storage_path: `notes/cli/${NFC}` }]);
  });

  test('files upload-raw (cloud branch): stores the NFC key', async () => {
    const png = NFD.replace(/\.txt$/, '.png');
    const out = await cli(['upload-raw', fixture('raw-mac', png, 'png bytes'), '--page', 'notes/raw', '--no-pointer']);
    const json = JSON.parse(out.find((l) => l.trim().startsWith('{'))!);
    expect(json.storagePath).toBe(`notes/raw/${png.normalize('NFC')}`);
    expect(await rowsFor('notes/raw')).toEqual([
      { filename: png.normalize('NFC'), storage_path: `notes/raw/${png.normalize('NFC')}` },
    ]);
  });

  test('files sync: an NFD and an NFC checkout of one folder are one file', async () => {
    const dir = 'ёжики';
    const mac = join(fixtureDir, 'sync-mac');
    const win = join(fixtureDir, 'sync-win');
    mkdirSync(join(mac, dir.normalize('NFD')), { recursive: true });
    mkdirSync(join(win, dir.normalize('NFC')), { recursive: true });
    writeFileSync(join(mac, dir.normalize('NFD'), NFD), 'sync bytes');
    writeFileSync(join(win, dir.normalize('NFC'), NFC), 'sync bytes');

    await cli(['sync', mac]);
    const second = await cli(['sync', win]);
    expect(second.join('\n')).toContain('0 uploaded, 1 skipped');
    // Matched on the key prefix, not page_slug: sync infers page_slug by
    // splitting on '/', which Windows' relative() output never contains.
    const rows = await engine.executeRaw<{ filename: string; storage_path: string }>(
      `SELECT filename, storage_path FROM files WHERE storage_path LIKE $1 OR storage_path LIKE $2 ORDER BY storage_path`,
      [`${dir.normalize('NFC')}/%`, `${dir.normalize('NFD')}/%`],
    );
    expect(rows).toEqual([{ filename: NFC, storage_path: `${dir.normalize('NFC')}/${NFC}` }]);
  });
});
