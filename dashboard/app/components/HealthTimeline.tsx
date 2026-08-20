'use client';

/**
 * HealthTimeline.tsx
 *
 * Renders a vertical timeline of heal events.
 * Each event shows: timestamp, description, resolved status.
 * Empty state shown if no events exist yet.
 */

import type { HealEvent } from '../../lib/data';

type Props = { events: HealEvent[] };

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
        const isResolved = evt.resolved;
        return (
          <article
            key={evt.id}
            className="timeline-item"
            style={{ animationDelay: `${i * 40}ms` }}
            aria-label={`Heal event: ${isResolved ? 'resolved' : 'unresolved'}`}
          >
            <div className={`timeline-dot ${isResolved ? 'resolved' : 'unresolved'}`} aria-hidden="true" />
            <div className={`timeline-card ${isResolved ? 'resolved' : 'unresolved'}`}>
              <div className="timeline-meta">
                <span
                  className={`status-badge ${isResolved ? 'healthy' : 'degraded'}`}
                  aria-label={isResolved ? 'Resolved' : 'Unresolved'}
                >
                  <span className="status-dot" />
                  {isResolved ? 'resolved' : 'unresolved'}
                </span>
                <time className="timeline-time" dateTime={evt.timestamp} title={formatTimestamp(evt.timestamp)}>
                  {timeAgo(evt.timestamp)}
                </time>
                <span className="timeline-time">·</span>
                <span className="timeline-time">{formatTimestamp(evt.timestamp)}</span>
              </div>
              <p className="timeline-desc">{evt.description}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
