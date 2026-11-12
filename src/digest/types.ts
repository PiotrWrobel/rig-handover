export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night.
export type DigestRow = {
  job: string;
  owner: string | null; // from the job's last line; views show null as `—`
  runs: number; // every valid line for this job
  retries: number; // lines with status `retry`
  lastStatus: RunStatus; // status of the job's last line
  lastError: string | null; // most recent `error` seen for this job, even if a later line is ok
  firstAt: string; // `at` exactly as logged, offset kept
  lastAt: string;
};

// One night, as the page, the JSON and the board all read it.
export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job (the reader sorts; nobody else does)
  badLines: number; // lines that are not valid JSON or not a valid entry
  counts: Record<RunStatus, number>; // valid lines per status
};

// null = no file for that night, or `night` is not YYYY-MM-DD. An empty file is a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
