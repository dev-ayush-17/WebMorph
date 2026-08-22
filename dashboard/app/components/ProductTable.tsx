'use client';

/**
 * ProductTable.tsx  (v0.3)
 *
 * v0.3 additions:
 *   - Price change indicator: ▲ (green) / ▼ (red) with previous price tooltip
 *   - Stock flip badge: shows "flipped" indicator when stock_changed is true
 *   - "New" badge for products seen for the first time (previous_price === null)
 *   - Highlighted rows for any changed products
 */

import type { Product } from '../../lib/data';

type Props = { products: Product[] };

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(price);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function PriceCell({ product }: { product: Product }) {
  const formatted = formatPrice(product.price, product.currency);

  if (!product.price_changed || product.previous_price === null) {
    return <span className="price-value">{formatted}</span>;
  }

  const isIncrease = product.price > product.previous_price;
  const diff = Math.abs(product.price - product.previous_price).toFixed(2);
  const prevFormatted = formatPrice(product.previous_price, product.currency);

  return (
    <span className="price-cell">
      <span className="price-value">{formatted}</span>
      <span
        className={`price-delta ${isIncrease ? 'price-up' : 'price-down'}`}
        title={`Was ${prevFormatted} (${isIncrease ? '+' : '-'}$${diff})`}
        aria-label={`Price ${isIncrease ? 'increased' : 'decreased'} from ${prevFormatted}`}
      >
        {isIncrease ? '▲' : '▼'} ${diff}
      </span>
    </span>
  );
}

function StockCell({ product }: { product: Product }) {
  return (
    <span className="stock-cell">
      {product.in_stock ? (
        <span className="stock-pill in" aria-label="In stock">
          <span style={{ fontSize: '0.5rem' }}>●</span> In stock
        </span>
      ) : (
        <span className="stock-pill out" aria-label="Out of stock">
          <span style={{ fontSize: '0.5rem' }}>○</span> Out of stock
        </span>
      )}
      {product.stock_changed && (
        <span className="change-badge stock-flip" title="Stock status changed since last run">
          flipped
        </span>
      )}
    </span>
  );
}

function NameCell({ product }: { product: Product }) {
  return (
    <span className="name-cell">
      <a
        href={product.product_url}
        target="_blank"
        rel="noopener noreferrer"
        title={product.product_url}
      >
        {product.product_name}
      </a>
      {product.previous_price === null && (
        <span className="change-badge new-product" title="First time seen in this dataset">
          new
        </span>
      )}
    </span>
  );
}

export default function ProductTable({ products }: Props) {
  if (products.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📭</div>
        <p className="empty-state-title">No products yet</p>
        <p className="empty-state-sub">
          Run <code className="mono">node scripts/run-pipeline.js</code> to populate.
        </p>
      </div>
    );
  }

  const changedCount = products.filter((p) => p.price_changed || p.stock_changed).length;

  return (
    <div className="table-wrap">
      {changedCount > 0 && (
        <div className="change-summary-bar" role="status" aria-live="polite">
          <span className="change-summary-icon">⚡</span>
          <span>
            <strong>{changedCount}</strong> product{changedCount !== 1 ? 's' : ''} changed since last run
          </span>
        </div>
      )}
      <table className="data-table" aria-label="Product prices and stock status">
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Price</th>
            <th scope="col">Currency</th>
            <th scope="col">Stock</th>
            <th scope="col">Scraped at</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr
              key={p.id}
              className={p.price_changed || p.stock_changed ? 'row-changed' : ''}
              aria-label={
                p.price_changed || p.stock_changed
                  ? `${p.product_name} — changed since last run`
                  : p.product_name
              }
            >
              <td className="td-name"><NameCell product={p} /></td>
              <td className="td-price"><PriceCell product={p} /></td>
              <td className="td-currency">{p.currency}</td>
              <td><StockCell product={p} /></td>
              <td className="td-ts">{formatTime(p.scraped_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
