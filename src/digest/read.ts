import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly string[] = ['ok', 'retry', 'fail'] satisfies RunStatus[];

type Entry = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

const isStatus = (value: unknown): value is RunStatus =>
  typeof value === 'string' && STATUSES.includes(value);

// One line in, one valid entry or null out. Only `at`, `job` and `status` decide validity;
// a non-string `owner` or `error` is read as null.
const parseLine = (line: string): Entry | null => {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string' || !isStatus(o.status)) return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status,
    owner: typeof o.owner === 'string' ? o.owner : null,
    error: typeof o.error === 'string' ? o.error : null,
  };
};

// null only when the file is not there; any other read error is real and is thrown.
const readFile = (path: string): string | null => {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
};

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  const text = readFile(join(runsDir, `${night}.jsonl`));
  if (text === null) return null;

  const byJob = new Map<string, DigestRow>();
  const counts: Record<RunStatus, number> = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const entry = parseLine(line);
    if (entry === null) {
      badLines += 1;
      continue;
    }
    counts[entry.status] += 1;
    const retry = entry.status === 'retry' ? 1 : 0;
    const row = byJob.get(entry.job);
    if (row === undefined) {
      byJob.set(entry.job, {
        job: entry.job,
        owner: entry.owner,
        runs: 1,
        retries: retry,
        lastStatus: entry.status,
        lastError: entry.error,
        firstAt: entry.at,
        lastAt: entry.at,
      });
      continue;
    }
    row.owner = entry.owner;
    row.runs += 1;
    row.retries += retry;
    row.lastStatus = entry.status;
    if (entry.error !== null) row.lastError = entry.error;
    row.lastAt = entry.at;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines, counts };
};
