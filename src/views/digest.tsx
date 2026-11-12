import type { Night } from '../digest/types.js';

const dash = <span class="mute">—</span>;

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest {night.night}</h1>
      {night.badLines > 0 && <p class="warn">bad lines: {night.badLines}</p>}
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((r) => (
              <tr class={r.retries >= 3 || r.lastStatus === 'fail' ? 'warn' : undefined}>
                <td>{r.job || dash}</td>
                <td>{r.owner || dash}</td>
                <td>{r.runs}</td>
                <td>{r.retries}</td>
                <td>{r.lastStatus || dash}</td>
                <td>{r.lastError || dash}</td>
                <td>{r.firstAt || dash}</td>
                <td>{r.lastAt || dash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
