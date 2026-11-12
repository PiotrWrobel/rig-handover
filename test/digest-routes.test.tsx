import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const line = (at: string, job: string, status: string, owner = 'rook') =>
  JSON.stringify({ at, job, status, owner });

writeFileSync(
  join(dir, '2026-01-01.jsonl'),
  [
    line('2026-01-01T01:00:00+01:00', 'zeta/job', 'ok'),
    line('2026-01-01T02:00:00+01:00', 'alpha/job', 'retry'),
    line('2026-01-01T03:00:00+01:00', 'alpha/job', 'ok'),
    line('2026-01-01T04:00:00+01:00', 'mid/job', 'ok'),
  ].join('\n') + '\n',
);
writeFileSync(join(dir, '2026-01-02.jsonl'), '');
writeFileSync(
  join(dir, '2026-01-03.jsonl'),
  [
    line('2026-01-03T01:00:00+01:00', 'b/job', 'ok'),
    'not json at all',
    '{"at": 1}',
    line('2026-01-03T02:00:00+01:00', 'a/job', 'ok'),
  ].join('\n') + '\n',
);

const app = createApp({
  adapter: 'test',
  installed: 'test',
  beatEverySeconds: 60,
  runsDir: dir,
});

const json = async (night: string) => app.request(`/api/digest/${night}`);
const page = async (night: string) => app.request(`/digest/${night}`);

describe('GET /digest/:night', () => {
  it('200 for a night on disk', async () => {
    const res = await page('2026-01-01');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('digest 2026-01-01');
    expect(html).not.toContain('bad lines');
  });

  it('404 for a night with no file', async () => {
    expect((await page('2026-01-09')).status).toBe(404);
  });

  it.each(['2026-10-28x', '..%2Frig', 'nope'])('404 for malformed night %s', async (n) => {
    expect((await page(n)).status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await page('2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('shows the bad line count', async () => {
    const res = await page('2026-01-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('bad lines: 2');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 with the night on disk', async () => {
    const res = await json('2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe('2026-01-01');
    expect(body.badLines).toBe(0);
    expect(body.rows).toHaveLength(3);
  });

  it('404 for a night with no file', async () => {
    expect((await json('2026-01-09')).status).toBe(404);
  });

  it.each(['2026-10-28x', '..%2Frig', 'nope'])('404 for malformed night %s', async (n) => {
    expect((await json(n)).status).toBe(404);
  });

  it('returns rows: [] for an empty night', async () => {
    const res = await json('2026-01-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('reports badLines', async () => {
    const body = (await (await json('2026-01-03')).json()) as Night;
    expect(body.badLines).toBe(2);
    expect(body.rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
  });
});

describe('page and JSON agree', () => {
  it.each(['2026-01-01', '2026-01-03'])('same jobs in the same order for %s', async (n) => {
    const body = (await (await json(n)).json()) as Night;
    const html = await (await page(n)).text();
    const inPage = [...html.matchAll(/<td>([a-z]+\/job)<\/td>/g)].map((m) => m[1]);
    expect(inPage).toEqual(body.rows.map((r) => r.job));
    expect(inPage.length).toBeGreaterThan(0);
  });
});
