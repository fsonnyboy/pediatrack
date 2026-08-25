'use client';

import { useGrowthChart } from '@/hooks/useGrowthChart';
import { GrowthChart } from '@/components/growth/GrowthChart';

interface Props {
  patientId: string;
}

export function GrowthChartPageClient({ patientId }: Props) {
  const { data, isLoading, error, refetch } = useGrowthChart(patientId);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="gc-page-loading">
        <div className="gc-page-spinner" />
        <p>Loading growth data…</p>
        <style>{`
          .gc-page-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 320px;
            gap: 12px;
            color: #6b7280;
            font-family: Inter, sans-serif;
          }
          .gc-page-spinner {
            width: 36px;
            height: 36px;
            border: 3px solid #e5e7eb;
            border-top-color: #1565C0;
            border-radius: 50%;
            animation: gc-page-spin 0.7s linear infinite;
          }
          @keyframes gc-page-spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="gc-page-error">
        <div className="gc-page-error__icon">⚠️</div>
        <p className="gc-page-error__msg">
          Could not load growth data: <strong>{error}</strong>
        </p>
        <button className="gc-page-error__retry" onClick={refetch}>
          Retry
        </button>
        <style>{`
          .gc-page-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 260px;
            gap: 10px;
            font-family: Inter, sans-serif;
            text-align: center;
          }
          .gc-page-error__icon  { font-size: 2rem; }
          .gc-page-error__msg   { color: #374151; font-size: 0.9rem; }
          .gc-page-error__retry {
            margin-top: 4px;
            padding: 8px 18px;
            background: #1565C0;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
          }
          .gc-page-error__retry:hover { background: #1251A3; }
        `}</style>
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (!data) return null;

  // ── Chart ──────────────────────────────────────────────────────────────────
  return (
    <div className="gc-page">
      <div className="gc-page-header">
        <div>
          <h2 className="gc-page-title">Growth Chart</h2>
          <p className="gc-page-sub">
            WHO 2006 Child Growth Standards · 0–60 months
          </p>
        </div>
        <button
          className="gc-page-refresh"
          onClick={refetch}
          title="Refresh data"
          aria-label="Refresh growth data"
        >
          ↻
        </button>
      </div>

      <GrowthChart data={data} chartHeight={420} />

      <style>{`
        .gc-page {
          display: flex;
          flex-direction: column;
          gap: 16px;
          font-family: Inter, system-ui, sans-serif;
        }
        .gc-page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .gc-page-title {
          font-size: 1.25rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--text, #111827);
          margin: 0;
        }
        .gc-page-sub {
          font-size: 0.8rem;
          color: var(--text-muted, #6b7280);
          margin: 2px 0 0;
        }
        .gc-page-refresh {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid var(--border, #e5e7eb);
          background: var(--card-bg, #fff);
          font-size: 18px;
          cursor: pointer;
          color: var(--text-muted, #6b7280);
          display: grid;
          place-items: center;
          flex-shrink: 0;
          margin-top: 2px;
          transition: all 0.15s;
        }
        .gc-page-refresh:hover { color: var(--text, #111827); background: var(--muted-bg, #f3f4f6); }
      `}</style>
    </div>
  );
}
