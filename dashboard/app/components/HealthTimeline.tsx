'use client';

/**
 * HealthTimeline.tsx  (v0.3)
 *
 * v0.3 additions:
 *   - Shows attempt_number, heal_method, error_type, duration_ms per event
 *   - Visually distinct states: healed (green), unresolved (red), simulated (amber)
 *   - Method badge: "real" vs "simulated" with distinct colors
 *   - Error type chip with semantic label
 */

import type { HealEvent } from '../../lib/data';

type Props = { events: HealEvent[] };

const ERROR_TYPE_LABELS: Record<string, string> = {
  empty_result:   'Empty result',
  missing_fields: 'Missing fields',
  type_mismatch:  'Type mismatch',
  cli_auth:       'CLI auth',
  collector_gone: 'Collector gone',
  unknown:        'Unknown',
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60)   return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getCardClass(evt: HealEvent): string {
  if (evt.heal_method === 'simulated') return 'simulated';
  return evt.resolved ? 'resolved' : 'unresolved';
}

function StatusBadge({ evt }: { evt: HealEvent }) {
  if (evt.heal_method === 'simulated') {
    return (
      <span className="status-badge mock" aria-label="Would-heal (mock mode)">
        <span className="status-dot" /> would-heal
      </span>
    );
  }
  return (
    <span
      className={`status-badge ${evt.resolved ? 'healthy' : 'degraded'}`}
      aria-label={evt.resolved ? 'Healed and resolved' : 'Unresolved — heal failed or retry empty'}
    >
      <span className="status-dot" />
      {evt.resolved ? 'healed' : 'unresolved'}
    </span>
  );
}

export default function HealthTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">✅</div>
        <p className="empty-state-title">No heal events recorded</p>
        <p className="empty-state-sub">
          The pipeline has not detected any broken scrape results yet.
          Run the pipeline a few times — mock data occasionally generates broken shapes.
        </p>
      </div>
    );
  }

  return (
    <div className="timeline" role="feed" aria-label="Pipeline health events">
      {events.map((evt, i) => {
        const cardClass = getCardClass(evt);
        return (
          <article
            key={evt.id}
            className="timeline-item"
            style={{ animationDelay: `${i * 40}ms` }}
            aria-label={`Heal event: ${cardClass}`}
          >
            <div className={`timeline-dot ${cardClass}`} aria-hidden="true" />
            <div className={`timeline-card ${cardClass}`}>

              {/* ── Header row: status + time ──────────────────────────── */}
              <div className="timeline-meta">
                <StatusBadge evt={evt} />
                <time
                  className="timeline-time"
                  dateTime={evt.timestamp}
                  title={formatTimestamp(evt.timestamp)}
                >
                  {timeAgo(evt.timestamp)}
                </time>
                <span className="timeline-time">·</span>
                <span className="timeline-time">{formatTimestamp(evt.timestamp)}</span>
              </div>

              {/* ── Description ───────────────────────────────────────── */}
              <p className="timeline-desc">{evt.description}</p>

              {/* ── Chips row: error_type, method, attempt, duration ──── */}
              <div className="timeline-chips" aria-label="Heal event details">
                <span
                  className={`heal-chip error-type-${evt.error_type}`}
                  title={`Error type: ${evt.error_type}`}
                >
                  {ERROR_TYPE_LABELS[evt.error_type] ?? evt.error_type}
                </span>
                <span
                  className={`heal-chip method-${evt.heal_method}`}
                  title={`Heal method: ${evt.heal_method}`}
                >
                  {evt.heal_method === 'real' ? '⚡ real heal' : '🔮 simulated'}
                </span>
                {(evt.attempt_number ?? 1) > 1 && (
                  <span className="heal-chip attempt-retry" title="More than one heal attempt was made">
                    attempt #{evt.attempt_number}
                  </span>
                )}
                {evt.duration_ms !== null && evt.duration_ms > 0 && (
                  <span className="heal-chip duration" title="Total time spent on this heal">
                    ⏱ {formatDuration(evt.duration_ms)}
                  </span>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
