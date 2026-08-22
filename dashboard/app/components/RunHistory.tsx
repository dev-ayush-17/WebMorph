'use client';

/**
 * RunHistory.tsx  (new in v0.3)
 *
 * Displays a table of recent pipeline run records from the `runs` table.
 * Shows: run ID (truncated), status, product count, price/stock changes,
 * heal events, and run duration.
 *
 * Empty state shown if no runs exist yet.
 */

import type { Run } from '../../lib/data';

type Props = { runs: Run[] };

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDuration(ms: number | undefined | null): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusBadge({ status }: { status: Run['status'] }) {
  const map: Record<Run['status'], { cls: string; label: string; icon: string }> = {
    healthy:  { cls: 'healthy',  label: 'Healthy',  icon: '✓' },
    degraded: { cls: 'degraded', label: 'Degraded', icon: '⚠' },
    failed:   { cls: 'failed',   label: 'Failed',   icon: '✗' },
    running:  { cls: 'running',  label: 'Running',  icon: '⟳' },
  };
  const { cls, label, icon } = map[status] ?? map.failed;
  return (
    <span className={`status-badge ${cls}`} aria-label={label}>
      <span className="status-dot" />{icon} {label}
    </span>
  );
}

export default function RunHistory({ runs }: Props) {
  if (runs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <p className="empty-state-title">No run history yet</p>
        <p className="empty-state-sub">
          Run the pipeline to populate this section.
          Each execution is logged with a full summary.
        </p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table runs-table" aria-label="Pipeline run history">
        <thead>
          <tr>
            <th scope="col">Run</th>
            <th scope="col">Status</th>
            <th scope="col">Products</th>
            <th scope="col">Δ Price</th>
            <th scope="col">Δ Stock</th>
            <th scope="col">Heals</th>
            <th scope="col">Duration</th>
            <th scope="col">Started</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const s = run.summary_json;
            const priceChanges = s ? s.price_increases + s.price_decreases : null;
            return (
              <tr
                key={run.id}
                className={`run-row status-${run.status}`}
                aria-label={`Run ${run.run_id}: ${run.status}`}
              >
                <td className="td-runid mono" title={run.run_id}>
                  {run.run_id.replace('run_', '').slice(0, 16)}…
                </td>
                <td><StatusBadge status={run.status} /></td>
                <td className="td-num">{s?.products_found ?? '—'}</td>
                <td className="td-num">
                  {priceChanges !== null ? (
                    <span className={priceChanges > 0 ? 'delta-nonzero' : 'delta-zero'}>
                      {priceChanges > 0 ? `↕ ${priceChanges}` : '—'}
                    </span>
                  ) : '—'}
                </td>
                <td className="td-num">
                  {s !== null ? (
                    <span className={s.stock_flips > 0 ? 'delta-nonzero' : 'delta-zero'}>
                      {s.stock_flips > 0 ? `⇄ ${s.stock_flips}` : '—'}
                    </span>
                  ) : '—'}
                </td>
                <td className="td-num">
                  {s !== null ? (
                    s.heal_events_total > 0 ? (
                      <span className={s.heal_events_unresolved > 0 ? 'heal-unresolved' : 'heal-resolved'}>
                        {s.heal_events_resolved}/{s.heal_events_total}
                      </span>
                    ) : <span className="delta-zero">—</span>
                  ) : '—'}
                </td>
                <td className="td-ts mono">{formatDuration(s?.duration_ms)}</td>
                <td className="td-ts">{formatTime(run.started_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
