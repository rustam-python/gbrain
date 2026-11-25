import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';

// A checkout's git fetch can stall, and no git setting bounds it. So every checkout in a validation workflow using
// the retry mechanism is a pair: a bounded first attempt, then the same checkout again only when the first failed.
type Step = { id?: string; if?: string; uses?: string; with?: Record<string, unknown>; 'timeout-minutes'?: number; 'continue-on-error'?: boolean };
type Job = { 'runs-on'?: unknown; strategy?: unknown; steps?: Step[] };
type Workflow = { jobs: Record<string, Job> };
const dir = join(import.meta.dir, '../../.github/workflows');
const workflows = readdirSync(dir).filter(f => f.endsWith('.yml')).sort()
  .map(file => ({ file, text: readFileSync(join(dir, file), 'utf8') }))
  .filter(({ text }) => /ubuntu-latest/.test(text) && /actions\/checkout@/.test(text) && text.includes('Check out again after a stalled first attempt'))
  .map(({ file, text }) => ({ file, parsed: load(text) as Workflow }));
const isCheckout = (step: Step) => step.uses?.startsWith('actions/checkout@') ?? false;
const onGitHubHostedLinux = (job: Job) => JSON.stringify([job['runs-on'], job.strategy]).includes('ubuntu-latest');

describe('a stalled checkout is bounded and tried again', () => {
  test('the scan finds the workflows that run the full suites', () => {
    expect(workflows.map(w => w.file)).toEqual(expect.arrayContaining(['e2e.yml', 'persistence-validation.yml', 'test.yml']));
  });

  test.each(workflows.map(w => [w.file, w] as const))('%s pairs every checkout with a bounded retry', (_file, w) => {
    for (const [job, spec] of Object.entries(w.parsed.jobs).filter(([, spec]) => onGitHubHostedLinux(spec))) {
      const steps = spec.steps ?? [];
      for (let i = 0; i < steps.length; i++) {
        const first = steps[i];
        if (!isCheckout(first)) continue;
        const where = `${w.file} job ${job} step ${i + 1}`;
        expect({ where, id: typeof first.id, continueOnError: first['continue-on-error'], bounded: (first['timeout-minutes'] ?? 0) > 0 })
          .toEqual({ where, id: 'string', continueOnError: true, bounded: true });
        const retry = steps[i + 1];
        expect({ where, retry: retry && { if: retry.if, uses: retry.uses, with: retry.with, timeout: retry['timeout-minutes'], continueOnError: retry['continue-on-error'] } })
          .toEqual({ where, retry: { if: `steps.${first.id}.outcome == 'failure'`, uses: first.uses, with: first.with, timeout: first['timeout-minutes'], continueOnError: undefined } });
        i++;
      }
    }
  });
});
