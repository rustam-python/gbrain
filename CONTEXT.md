# GBrain — domain language

A shared vocabulary for working on GBrain. Terms are named as they appear in
the code. If a word is used differently from what is written here, the
disagreement is about this file, not about a code comment.

## Language

**Brain**:
One database with its own content and access policy.
_Avoid_: "database", "instance", "store" — they do not separate a Brain from its Engine.

**Source**:
A named set of pages inside one Brain. Slugs are unique per
`(source_id, slug)`, not on their own.
_Avoid_: "repository", "collection", "namespace".

**Engine**:
What a Brain runs on: `pglite` or `postgres`. A property of the connection,
not of the data.
_Avoid_: "backend", "driver".

**Slug**:
The stable identifier of a page inside a Source. Derived from a file name or
from an entity name.
_Avoid_: "path", "key", "page id".

**Slug grammar**:
The rule that turns free text into a Slug: which characters are kept, which
fold, which are dropped. Every grammar shares one letter fold
(`cjk.ts:foldSlugText`).

**Exact-slug step**:
The check that runs before any fuzzy match: a value that already looks like a
Slug is looked up exactly. Its shape test must accept everything the Slug
grammar produces. Otherwise a real page is skipped and fuzzy matching may pick
a sibling.
_Avoid_: "slug-shape check", "step 1" — both depend on which resolver you mean.

**Lexical arm**:
The search branch that matches words. Language-dependent: stemming and stop
words come from one configuration for the whole Brain.
_Avoid_: "full-text search", "FTS" — in conversation they drift away from "arm".

**Vector arm**:
The search branch that matches meaning through embeddings. Language-agnostic.

**Entity**:
A page representing a person or an organization, under `people/` or
`companies/`. Born from extraction out of text, not from syncing a file.

**Atom**:
One standalone idea extracted by the dream cycle from a transcript or a
prose page (a meeting, an article, a note).
_Avoid_: "fact", "note" — facts and notes are separate kinds of record.

**Concept label**:
A short topic name that the dream cycle assigns to an Atom. Atoms that share
a label are gathered into one Concept. Written in the Исходный язык, and never
the name of an Entity or a product: a technical topic gets a descriptive label
("очереди-сообщений") even when the text uses the English term ("queue").
_Avoid_: "tag" — tags are set by people and do not gather Atoms.

**Concept**:
A page that sums up every Atom sharing one Concept label. Its Slug and title
come from the label.

**Исходный язык**:
The language of the text the dream cycle writes a page from: a transcript,
or the Atoms and reflections being summed up. Decided by the language most of
that text is written in. The page's prose follows it; names, product names,
commands and technical terms stay exactly as the author wrote them.
_Avoid_: "source language" — **Source** already means a set of pages.

**Alias**:
An alternative spelling that leads to the same Entity. The layer where
different spellings of one name merge, without touching the Slug.

## Model benchmark

**Fact (benchmark)**:
One row of the facts table: free text `fact`, the person it is about
(`entity_slug`) and the date it holds from (`valid_from`). Not an Atom.

**Reference fact**:
A fact planted in a benchmark dialogue on purpose, with a known person, value
and date. The ground truth the benchmark scores against.

**Completeness**:
The share of reference facts that the model extracted. A reference fact is
counted only if, in an extracted row of the same dialogue, the value appears in
the `fact` text (case and whitespace normalised, a Russian inflected ending
tolerated), `valid_from` equals the reference date, and the person is named
correctly. The extractor leaves `entity_slug` empty on conversation facts, so
the person is read from the names in the `fact` text. A row with no name at
all ("я переехал в Казань") is Anonymous, not counted as complete.

**Anonymous fact**:
An extracted fact with the right value and date but no person that can be
told from the row. Reported apart; it has its own completeness figure.

**Garbage**:
An extracted fact that matches no reference fact and is neither an
attribution error nor a duplicate. Facts taken from chatter or hypothetical
reasoning are garbage. The `EXTRACTION_COMPLETE` marker row gbrain writes per
page is counted apart as a service row.

**Attribution error**:
An extracted fact with a correct value attached to the wrong person. Counted
separately from Garbage.

**Duplicate**:
A second extracted fact that matches an already counted reference fact.
Counted separately from Garbage.

**Model config**:
One model plus the launch script and reasoning setting it runs under. The
benchmark compares configs, not bare models.
