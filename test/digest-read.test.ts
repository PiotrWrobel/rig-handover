import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';
import type { Night } from '../src/digest/types.js';

const RUNS = 'runs';

const mustRead = (dir: string, night: string): Night => {
  const result = readNight(dir, night);
  if (result === null) throw new Error(`expected a night for ${night}`);
  return result;
};

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = mustRead(RUNS, '2026-10-28');
  const row = (job: string) => night.rows.find((r) => r.job === job);

  it('reads 5 jobs, sorted by job, and 1 bad line', () => {
    expect(night.night).toBe('2026-10-28');
    expect(night.rows).toHaveLength(5);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.badLines).toBe(1);
  });

  it('counts ok 10 / retry 4 / fail 1', () => {
    expect(night.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('fixtures/refresh: runs 4, retries 3, last ok, lastError upstream 503', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('digest/render has owner null', () => {
    expect(row('digest/render')?.owner).toBeNull();
  });

  it('notes/backup failed with its error', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });
});

describe('readNight on runs/2026-10-27.jsonl', () => {
  it('reads a clean night', () => {
    const night = mustRead(RUNS, '2026-10-27');
    expect(night.badLines).toBe(0);
    expect(night.counts).toEqual({ ok: 7, retry: 0, fail: 0 });
    expect(night.rows.map((r) => r.job)).toEqual([
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.rows.find((r) => r.job === 'lane/sync')).toMatchObject({
      runs: 4,
      retries: 0,
      lastError: null,
      firstAt: '2026-10-27T23:00:05+01:00',
      lastAt: '2026-10-28T05:00:04+01:00',
    });
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-read-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null for a missing file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('returns null for a bad night string', () => {
    for (const bad of ['../runs/2026-10-28', '2026-10-28.jsonl', '20261028', '', '2026-10-2', 'x2026-10-28']) {
      expect(readNight(RUNS, bad)).toBeNull();
    }
  });

  it('reads an empty file as a night with no rows', () => {
    writeFileSync(join(dir, '2026-02-01.jsonl'), '');
    expect(readNight(dir, '2026-02-01')).toEqual({
      night: '2026-02-01',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts odd lines as bad, ignores blank lines, never throws', () => {
    const lines = [
      '{"at":"2026-03-01T01:00:00+02:00","job":"b","status":"retry","owner":"x","error":"e1"}',
      '',
      '   ',
      'not json',
      '[1,2]',
      'null',
      '42',
      '{"job":"a","status":"ok"}',
      '{"at":"t","status":"ok"}',
      '{"at":"t","job":"a","status":"done"}',
      '{"at":1,"job":"a","status":"ok"}',
      '{"at":"2026-03-01T02:00:00+02:00","job":"b","status":"ok","owner":null}\r',
      '{"at":"2026-03-01T03:00:00+02:00","job":"a","status":"fail","error":"boom"}',
    ];
    writeFileSync(join(dir, '2026-03-01.jsonl'), lines.join('\n') + '\n');
    const night = mustRead(dir, '2026-03-01');
    expect(night.badLines).toBe(8);
    expect(night.counts).toEqual({ ok: 1, retry: 1, fail: 1 });
    expect(night.rows).toEqual([
      {
        job: 'a',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'boom',
        firstAt: '2026-03-01T03:00:00+02:00',
        lastAt: '2026-03-01T03:00:00+02:00',
      },
      {
        job: 'b',
        owner: null,
        runs: 2,
        retries: 1,
        lastStatus: 'ok',
        lastError: 'e1',
        firstAt: '2026-03-01T01:00:00+02:00',
        lastAt: '2026-03-01T02:00:00+02:00',
      },
    ]);
  });
});
