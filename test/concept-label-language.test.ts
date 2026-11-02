import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  sourceLanguageRule,
  CONCEPT_LABEL_RULE,
  SLUG_CHARS_RULE,
  SLUG_LANGUAGE_RULE,
  isConceptLabel,
} from '../src/core/cycle/source-language.ts';

/**
 * Pins ADR-0002 (docs/adr/0002-concept-labels-in-the-source-text-language.md).
 *
 * Upstream's dream prompts ask for English prose, ASCII slugs and English
 * Concept labels. The Исходный язык rule lives only in this fork, as wording
 * spliced into five prompts, so a merge from upstream can drop it from any
 * one of them and leave every other test green. The wiring checks read the
 * prompt files as text because the prompt builders are not exported.
 */

const CYCLE = join(import.meta.dir, '..', 'src', 'core', 'cycle');
const MINIONS = join(import.meta.dir, '..', 'src', 'core', 'minions');
const read = (file: string) => readFileSync(join(CYCLE, file), 'utf8');

describe('ADR-0002: Concept labels follow the Исходный язык', () => {
  test('a Cyrillic label is a valid Concept label', () => {
    expect(isConceptLabel('очереди-сообщений')).toBe(true);
    expect(isConceptLabel('captive-portal')).toBe(true);
  });

  test('a label the slug grammar would rewrite is rejected', () => {
    expect(isConceptLabel('')).toBe(false);
    expect(isConceptLabel('Очереди сообщений')).toBe(false);
    expect(isConceptLabel('queue_name')).toBe(false);
    expect(isConceptLabel('-очереди')).toBe(false);
  });

  test('the label rule asks for the language of the atoms, not English', () => {
    expect(CONCEPT_LABEL_RULE).toContain('очереди-сообщений');
    expect(CONCEPT_LABEL_RULE).toContain(SLUG_CHARS_RULE);
    expect(CONCEPT_LABEL_RULE).toContain('in the same language as the atoms');
  });

  test('the slug-character rule is not ASCII-only', () => {
    expect(SLUG_CHARS_RULE).toContain('any script');
    expect(SLUG_LANGUAGE_RULE).toContain('language of the page title');
  });

  test('the page-language rule forbids translating the input', () => {
    const rule = sourceLanguageRule('the transcript');
    expect(rule).toContain('the language most of the transcript is written in');
    expect(rule).toContain('never translate');
  });

  describe('every prompt that writes page text carries the rule', () => {
    test('extract_atoms: language rule and Concept label rule', () => {
      const src = read('extract-atoms.ts');
      expect(src).toContain("${sourceLanguageRule('the transcript')}");
      expect(src).toContain('${CONCEPT_LABEL_RULE}');
    });

    test('extract_atoms parse drops labels the slug grammar would rewrite', () => {
      expect(read('extract-atoms-parse.ts')).toContain('isConceptLabel(c)');
    });

    test('synthesize: slug rules and language rule', () => {
      const src = read('synthesize.ts');
      expect(src).toContain('${SLUG_CHARS_RULE}');
      expect(src).toContain('${SLUG_LANGUAGE_RULE}');
      expect(src).toContain("${sourceLanguageRule('the transcript')}");
      // Upstream's ASCII-only wording must not come back.
      expect(src).not.toContain('lowercase alphanumeric and hyphens only');
      expect(src).not.toContain('[^a-z0-9]+');
    });

    test('synthesize concepts: summary follows the language of the atoms', () => {
      const src = read('synthesize-concepts.ts');
      expect(src).toContain("${sourceLanguageRule('the atoms')}");
      expect(src).not.toContain('plain English');
    });

    test('oneshot synthesize (the default path): slug rules', () => {
      const src = readFileSync(join(MINIONS, 'handlers', 'subagent-oneshot.ts'), 'utf8');
      expect(src).toContain('${SLUG_CHARS_RULE}');
      expect(src).toContain('${SLUG_LANGUAGE_RULE}');
    });

    test('put_page tool description: slug characters', () => {
      const src = readFileSync(join(MINIONS, 'tools', 'brain-allowlist.ts'), 'utf8');
      expect(src).toContain('${SLUG_CHARS_RULE}');
    });

    test('patterns: slug rules and language rule', () => {
      const src = read('patterns.ts');
      expect(src).toContain('${SLUG_CHARS_RULE}; ${SLUG_LANGUAGE_RULE}');
      expect(src).toContain("${sourceLanguageRule('the reflections')}");
    });
  });
});
