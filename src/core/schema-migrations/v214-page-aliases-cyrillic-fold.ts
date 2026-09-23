import type { Migration } from './types.ts';

// Applied by src/core/migrate.ts on the next initSchema(); see docs/ENGINES.md
// ("Canonical schema sources") for when schema.sql or a TS fragment also changes.
//
// normalizeAlias now folds ё → е and drops a Cyrillic stress mark (U+0301)
// after lowercasing (ADR-0001), on both the write and the read side. Rows
// written before that would never match a query again, so re-key them with
// the same two folds (alias_norm is already NFKC + lowercase). Rows that
// collapse onto a sibling of the same page lose the duplicate first (keeping
// an already-folded row, else the oldest), so the (source_id, alias_norm,
// slug) unique key cannot fire. Idempotent.
// test/cyrillic-slug-grammar.test.ts pins this SQL to normalizeAlias.
export const v214: Migration = {
  version: 214,
  name: 'page_aliases_cyrillic_fold',
  idempotent: true,
  sql: `
    DELETE FROM page_aliases a USING page_aliases b
     WHERE regexp_replace(replace(a.alias_norm, 'ё', 'е'), '([Ѐ-ӿ])́+', '\\1', 'g') <> a.alias_norm
       AND b.id <> a.id
       AND b.source_id = a.source_id AND b.slug = a.slug
       AND regexp_replace(replace(b.alias_norm, 'ё', 'е'), '([Ѐ-ӿ])́+', '\\1', 'g')
         = regexp_replace(replace(a.alias_norm, 'ё', 'е'), '([Ѐ-ӿ])́+', '\\1', 'g')
       AND (regexp_replace(replace(b.alias_norm, 'ё', 'е'), '([Ѐ-ӿ])́+', '\\1', 'g') = b.alias_norm
            OR b.id < a.id);
    UPDATE page_aliases SET alias_norm = regexp_replace(replace(alias_norm, 'ё', 'е'), '([Ѐ-ӿ])́+', '\\1', 'g')
     WHERE regexp_replace(replace(alias_norm, 'ё', 'е'), '([Ѐ-ӿ])́+', '\\1', 'g') <> alias_norm;
  `,
};
