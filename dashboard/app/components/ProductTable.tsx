'use client';

/**
 * ProductTable.tsx
 *
 * Renders the product price table.
 * Intentional layout choice: dense data table (not cards) — matches the
 * monitoring/terminal aesthetic of the Terminal Amber theme.
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

  return (
    <div className="table-wrap">
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
            <tr key={p.id}>
              <td className="td-name">
                <a
                  href={p.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={p.product_url}
                >
                  {p.product_name}
                </a>
              </td>
              <td className="td-price">{formatPrice(p.price, p.currency)}</td>
              <td className="td-currency">{p.currency}</td>
              <td>
                {p.in_stock ? (
                  <span className="stock-pill in" aria-label="In stock">
                    <span style={{ fontSize: '0.5rem' }}>●</span> In stock
                  </span>
                ) : (
                  <span className="stock-pill out" aria-label="Out of stock">
                    <span style={{ fontSize: '0.5rem' }}>○</span> Out of stock
                  </span>
                )}
              </td>
              <td className="td-ts">{formatTime(p.scraped_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
