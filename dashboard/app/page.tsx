/**
 * dashboard/app/page.tsx  (v0.3)
 *
 * v0.3 additions:
 *   - Imports getRunHistory() + RunHistory component
 *   - Sidebar: price change summary + version bump to v0.3
 *   - New "Run History" section at bottom of main area
 *   - Source sidebar updated to reflect v0.2 integration status
 */

import { getLatestProducts, getHealEvents, getRunHistory, isConfigured } from '../lib/data';
import ProductTable from './components/ProductTable';
import HealthTimeline from './components/HealthTimeline';
import RunHistory from './components/RunHistory';

export const revalidate = 300; // ISR: re-fetch every 5 minutes

export default async function DashboardPage() {
  const [products, healEvents, runs] = await Promise.all([
    getLatestProducts(),
    getHealEvents(),
    getRunHistory(),
  ]);

  const configured = isConfigured();
  const inStockCount        = products.filter((p) => p.in_stock).length;
  const priceChangedCount   = products.filter((p) => p.price_changed).length;
  const stockChangedCount   = products.filter((p) => p.stock_changed).length;
  const healUnresolvedCount = healEvents.filter((e) => !e.resolved).length;
  const lastScrapedAt       = products[0]?.scraped_at ?? null;
  const lastRunId           = products[0]?.run_id ?? null;

  return (
    <div className="page-shell">

      {/* ── Topbar ─────────────────────────────────────────────────── */}
      <header className="page-topbar">
        <div className="brand">
          <div className="brand-icon" aria-hidden="true">🕷</div>
          <span className="brand-name">Undying Scraper</span>
          <span className="brand-version">v0.3</span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {healUnresolvedCount > 0 ? (
            <span className="status-badge degraded">
              <span className="status-dot pulse" />
              {healUnresolvedCount} unresolved event{healUnresolvedCount > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="status-badge healthy">
              <span className="status-dot pulse" />
              pipeline healthy
            </span>
          )}
          <span className="status-badge pending">
            {configured ? 'live data' : 'mock data'}
          </span>
        </div>
      </header>

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside className="page-sidebar">
        <div>
          <p className="sidebar-label">Pipeline</p>
          <div className="stat-stack">
            <div className="stat-item">
              <span className="stat-label">Products tracked</span>
              <span className="stat-value accent">{products.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">In stock</span>
              <span className="stat-value green">{inStockCount}</span>
              <span className="stat-sub">{products.length - inStockCount} out of stock</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Heal events</span>
              <span className={`stat-value ${healUnresolvedCount > 0 ? 'red' : 'green'}`}>
                {healEvents.length}
              </span>
              <span className="stat-sub">{healUnresolvedCount} unresolved</span>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* v0.3: price/stock change summary */}
        {(priceChangedCount > 0 || stockChangedCount > 0) && (
          <>
            <div>
              <p className="sidebar-label">Changes (this run)</p>
              <div className="stat-stack">
                {priceChangedCount > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Price changes</span>
                    <span className="stat-value accent">{priceChangedCount}</span>
                  </div>
                )}
                {stockChangedCount > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Stock flips</span>
                    <span className="stat-value accent">{stockChangedCount}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="divider" />
          </>
        )}

        <div>
          <p className="sidebar-label">Last run</p>
          <div className="stat-stack">
            {lastScrapedAt ? (
              <div className="stat-item">
                <span className="stat-label">Scraped at</span>
                <span className="stat-sub mono" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {new Date(lastScrapedAt).toLocaleString('en-US', {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                    hour12: false,
                  })}
                </span>
              </div>
            ) : null}
            {lastRunId ? (
              <div className="stat-item">
                <span className="stat-label">Run ID</span>
                <span className="stat-sub mono truncate" style={{ fontSize: '0.6875rem' }}>
                  {lastRunId}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="divider" />

        <div>
          <p className="sidebar-label">Source</p>
          <div className="stat-stack">
            <div className="stat-item">
              <span className="stat-label">Collector</span>
              <span className="stat-sub mono" style={{ color: 'var(--amber-400)' }}>
                {configured ? 'Bright Data (live)' : 'mock-source.js'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Bright Data</span>
              <span className="stat-sub">{configured ? '✓ Connected' : 'Pending target site'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Run history</span>
              <span className="stat-sub">{runs.length} run{runs.length !== 1 ? 's' : ''} recorded</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────── */}
      <main className="page-main">
        {!configured && (
          <div className="dev-banner" role="status">
            <span>⚡</span>
            <span>
              <strong>Dev mode</strong> — showing mock data. Add{' '}
              <code className="mono" style={{ fontSize: '0.8125rem' }}>NEXT_PUBLIC_SUPABASE_URL</code>{' '}
              and{' '}
              <code className="mono" style={{ fontSize: '0.8125rem' }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{' '}
              to <code className="mono" style={{ fontSize: '0.8125rem' }}>dashboard/.env.local</code> to load live data.
            </span>
          </div>
        )}

        {/* Product table */}
        <section aria-labelledby="products-heading">
          <div className="section-header">
            <h1 id="products-heading" className="section-title">
              Product Prices
            </h1>
            <span className="section-count">{products.length} items</span>
          </div>
          <ProductTable products={products} />
        </section>

        {/* Health timeline */}
        <section aria-labelledby="health-heading">
          <div className="section-header">
            <h2 id="health-heading" className="section-title">
              Health Timeline
            </h2>
            {healEvents.length > 0 && (
              <span className="section-count">{healEvents.length} events</span>
            )}
          </div>
          <HealthTimeline events={healEvents} />
        </section>

        {/* Run history (new in v0.3) */}
        <section aria-labelledby="runs-heading">
          <div className="section-header">
            <h2 id="runs-heading" className="section-title">
              Run History
            </h2>
            {runs.length > 0 && (
              <span className="section-count">{runs.length} runs</span>
            )}
          </div>
          <RunHistory runs={runs} />
        </section>
      </main>

    </div>
  );
}
