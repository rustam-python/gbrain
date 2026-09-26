import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { PGLiteEngine } from '../src/core/pglite-engine.ts';
import { retireSupersededTwins, twinCheckForFullSync } from '../src/core/sync-twins.ts';

/**
 * Retiring an old-slug twin is two writes — soft-delete the twin, redirect its
 * slug to the page that replaced it. They must land together: a twin deleted
 * without its redirect breaks every link to the old slug, and the row is gone
 * from the next reconcile, so nothing would ever retry it.
 */

let engine: PGLiteEngine;
const SRC = 'default';
const TWIN = { slug: 'wiki/елка', canonical: 'wiki/ёлка' };
const noFiles = () => ({ slugs: new Set<string>(), complete: true });

async function live(slug: string) {
  const [row] = await engine.executeRaw<{ live: boolean }>(
    `SELECT deleted_at IS NULL AS live FROM pages WHERE source_id = $1 AND slug = $2`, [SRC, slug],
  );
  return row?.live;
}
async function redirect(slug: string) {
  const [row] = await engine.executeRaw<{ canonical_slug: string }>(
    `SELECT canonical_slug FROM slug_aliases WHERE source_id = $1 AND alias_slug = $2`, [SRC, slug],
  );
  return row?.canonical_slug;
}

/** The engine, with executeRaw failing for SQL the predicate picks (inside transactions too). */
function failing(pick: (sql: string) => boolean): PGLiteEngine {
  const wrap = (target: PGLiteEngine): PGLiteEngine => new Proxy(target, {
    get(t, key, recv) {
      if (key === 'transaction') {
        return (fn: (tx: PGLiteEngine) => Promise<unknown>) =>
          (Reflect.get(t, key, recv) as Function).call(t, (tx: PGLiteEngine) => fn(wrap(tx)));
      }
      if (key === 'executeRaw') {
        return (sql: string, ...rest: unknown[]) => pick(sql)
          ? Promise.reject(new Error('injected failure'))
          : (Reflect.get(t, key, recv) as Function).call(t, sql, ...rest);
      }
      const v = Reflect.get(t, key, recv);
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  return wrap(engine);
}

beforeAll(async () => {
  engine = new PGLiteEngine();
  await engine.connect({});
  await engine.initSchema();
});
afterAll(async () => { await engine.disconnect(); });
beforeEach(async () => {
  await engine.executeRaw(`DELETE FROM slug_aliases`);
  await engine.executeRaw(`DELETE FROM pages`);
  for (const slug of [TWIN.slug, TWIN.canonical]) {
    await engine.executeRaw(
      `INSERT INTO pages (source_id, slug, type, title, compiled_truth, source_path) VALUES ($1, $2, 'concept', 't', 't', 'wiki/Ёлка.md')`,
      [SRC, slug],
    );
  }
});

describe('retiring an old-slug twin', () => {
  test('soft-deletes the twin and redirects its slug to the page that replaced it', async () => {
    expect(await retireSupersededTwins(engine, SRC, [TWIN], () => {}, noFiles)).toBe(1);
    expect(await live(TWIN.slug)).toBe(false);
    expect(await redirect(TWIN.slug)).toBe(TWIN.canonical);
  });

  test('a failed redirect write leaves the twin live and says so, so the next full sync retries it', async () => {
    const lines: string[] = [];
    const retired = await retireSupersededTwins(
      failing((sql) => /INSERT INTO slug_aliases/i.test(sql)), SRC, [TWIN], (l) => lines.push(l), noFiles,
    );
    expect(retired).toBe(0);
    expect(await live(TWIN.slug)).toBe(true);
    expect(lines.join('\n')).toContain(TWIN.slug);
  });

  test('a redirect the owner already set for the old slug is kept', async () => {
    await engine.executeRaw(
      `INSERT INTO slug_aliases (source_id, alias_slug, canonical_slug) VALUES ($1, $2, 'wiki/manual')`, [SRC, TWIN.slug],
    );
    expect(await retireSupersededTwins(engine, SRC, [TWIN], () => {}, noFiles)).toBe(1);
    expect(await live(TWIN.slug)).toBe(false);
    expect(await redirect(TWIN.slug)).toBe('wiki/manual');
  });
});

describe('the import-time twin check a full sync hands the import (#6)', () => {
  const slugOf = (p: string) => p.replace(/\.md$/, '').toLowerCase();
  const files = (...slugs: string[]) => () => ({ slugs: new Set(slugs), complete: true });
  const dup = { slug: 'wiki/елка', source_path: 'wiki/Ёлка.md' };
  const imported = { slug: 'wiki/ёлка', sourcePath: 'wiki/Ёлка.md' };

  test('a same-path page no file derives to is a twin, whatever the path separator', () => {
    expect(twinCheckForFullSync(slugOf, files('wiki/ёлка'))(dup, imported)).toBe(true);
    expect(twinCheckForFullSync(slugOf, files('wiki/ёлка'))(dup, { ...imported, sourcePath: 'wiki\\Ёлка.md' })).toBe(true);
  });

  test('a page some file still derives to is live, not a twin, even with the same path (#3583)', () => {
    expect(twinCheckForFullSync(slugOf, files('wiki/ёлка', 'wiki/елка'))(dup, imported)).toBe(false);
  });

  test('a different path, a missing path, or a slug the path does not produce is not a twin', () => {
    const check = twinCheckForFullSync(slugOf, files('wiki/ёлка'));
    expect(check({ ...dup, source_path: 'wiki/other.md' }, imported)).toBe(false);
    expect(check({ ...dup, source_path: null }, imported)).toBe(false);
    expect(check(dup, { ...imported, slug: 'wiki/frontmatter-slug' })).toBe(false);
  });

  test('an incomplete or failing file index finds no twins', () => {
    expect(twinCheckForFullSync(slugOf, () => ({ slugs: new Set(), complete: false }))(dup, imported)).toBe(false);
    expect(twinCheckForFullSync(slugOf, () => { throw new Error('git failed'); })(dup, imported)).toBe(false);
  });

  test('the file index is built once, on first use', () => {
    let builds = 0;
    const check = twinCheckForFullSync(slugOf, () => { builds++; return { slugs: new Set<string>(), complete: true }; });
    expect(builds).toBe(0);
    check(dup, imported); check(dup, imported);
    expect(builds).toBe(1);
  });
});
