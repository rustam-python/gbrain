/**
 * Exact page-slug candidates for a path-shaped frontmatter value (#6701,
 * #6623), shared by `makeResolver` step 1 (link-extraction.ts) and the
 * `extract --source fs` resolver so the two gates cannot drift.
 */
import { slugifyPath } from './sync.ts';
import { SLUG_PATH_SHAPE_RE } from './cjk.ts';

/** A value already in page-slug shape: every script (ADR-0001), digits, then `/`, `_`, `.`, `-`. */
export const EXACT_SLUG_SHAPE_RE = SLUG_PATH_SHAPE_RE;

/**
 * The exact page slugs a path-shaped frontmatter value can name, in lookup
 * order: the value itself when it is slug-shaped (`companies/acme.io`,
 * `90-people/nicolai`), then `slugifyPath(value)`, the slug sync mints for
 * that file path (`sources/voice/2030-01-01 1200 Call with Mira` →
 * `sources/voice/2030-01-01-1200-call-with-mira`; strips `.md`). Values
 * without `/` get none: bare names go through the dir-hint and fuzzy steps.
 */
export function exactSlugCandidates(value: string): string[] {
  if (!value.includes('/')) return [];
  const candidates = EXACT_SLUG_SHAPE_RE.test(value) ? [value] : [];
  const minted = slugifyPath(value);
  if (minted.includes('/') && !candidates.includes(minted)) candidates.push(minted);
  return candidates;
}
