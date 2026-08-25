'use client';

/**
 * GrowthChart — interactive WHO 2006 growth chart using Apache ECharts.
 *
 * Install once:
 *   npm install echarts echarts-for-react
 *
 * Usage:
 *   <GrowthChart data={growthChartResponse} />
 *
 * `data` is the JSON returned by GET /api/v1/patients/:id/growth-chart
 * (see api/src/modules/patients/patients.service.ts → getGrowthChart).
 */

import React, { useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { EChartsOption, SeriesOption } from 'echarts';
import {
  GrowthMetric,
  Sex,
  METRIC_META,
  REFERENCE_PERCENTILES,
  buildReferenceCurve,
  computePercentile,
  classifyZScore,
} from './growth-lms';

// ── Dynamic import avoids SSR crash (ECharts uses window/document). ───────────
const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => (
    <div className="gc-loader" aria-label="Loading chart…">
      <div className="gc-spinner" />
    </div>
  ),
});

// ── API shape ─────────────────────────────────────────────────────────────────

export interface GrowthPoint {
  recordedAt: string;        // ISO date string
  ageMonths: number;
  weightKg: number | null;
  heightCm: number | null;
  headCircumference: number | null;
  bmi: number | null;
  /** Optional — server may already compute these; component re-computes client-side if absent. */
  percentiles?: {
    weight?: { percentile: number; zScore: number } | null;
    height?: { percentile: number; zScore: number } | null;
    headCircumference?: { percentile: number; zScore: number } | null;
    bmi?: { percentile: number; zScore: number } | null;
  };
}

export interface GrowthChartData {
  patientId: string;
  sex: Sex;
  dateOfBirth: string;
  points: GrowthPoint[];
}

// ── Value extractors ──────────────────────────────────────────────────────────

const VALUE_OF: Record<GrowthMetric, (p: GrowthPoint) => number | null> = {
  weight: p => p.weightKg,
  height: p => p.heightCm,
  head:   p => p.headCircumference,
  bmi:    p => p.bmi,
};

// ── ECharts colour tokens ─────────────────────────────────────────────────────

const PATIENT_COLOR  = '#E55A22';
const NORMAL_BAND_BG = 'rgba(42,157,143,0.06)';

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  data: GrowthChartData;
  /** Height of the chart canvas in pixels. Default: 400. */
  chartHeight?: number;
  /** Override the sex used for reference curves (default: data.sex). */
  defaultSex?: Sex;
}

export function GrowthChart({ data, chartHeight = 400, defaultSex }: Props) {
  const [metric, setMetric]   = useState<GrowthMetric>('weight');
  const [sex, setSex]         = useState<Sex>(defaultSex ?? data.sex ?? 'MALE');

  const meta = METRIC_META[metric];

  // ── Patient series data ────────────────────────────────────────────────────
  const patientSeries = useMemo(() => {
    const extract = VALUE_OF[metric];
    return data.points
      .map(pt => {
        const val = extract(pt);
        if (val == null) return null;
        const pct = computePercentile(metric, sex, pt.ageMonths, val);
        return { age: pt.ageMonths, val, pct, recordedAt: pt.recordedAt };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [data.points, metric, sex]);

  // ── Reference curves ──────────────────────────────────────────────────────
  const refCurves = useMemo(
    () => REFERENCE_PERCENTILES.map(p => ({
      ...p,
      points: buildReferenceCurve(metric, sex, p.z),
    })),
    [metric, sex],
  );

  // ── Latest stat ────────────────────────────────────────────────────────────
  const latestStat = useMemo(() => {
    if (!patientSeries.length) return null;
    const last = patientSeries[patientSeries.length - 1];
    const cls = last.pct ? classifyZScore(last.pct.zScore) : null;
    return { ...last, cls };
  }, [patientSeries]);

  // ── ECharts option ────────────────────────────────────────────────────────
  const option: EChartsOption = useMemo(() => {
    // Reference curve series
    const refSeries: SeriesOption[] = refCurves.map(curve => ({
      name: curve.label,
      type: 'line',
      data: curve.points.map(p => [p.ageMonths, p.value]),
      lineStyle: {
        color: curve.color,
        width: curve.width,
        type: curve.dashType.length ? curve.dashType : 'solid',
      },
      symbol: 'none',
      silent: true,
      emphasis: { disabled: true },
      z: 1,
    }));

    // Shaded normal band — markArea between 25th and 75th percentiles
    // (Applied to the 50th-percentile series as a background band)
    const p25 = refCurves.find(c => c.label === '25th')!.points;
    const p75 = refCurves.find(c => c.label === '75th')!.points;

    const normalBandSeries: SeriesOption = {
      name: 'Normal range',
      type: 'line',
      data: p25.map(p => [p.ageMonths, p.value]),
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      symbol: 'none',
      silent: true,
      emphasis: { disabled: true },
      stack: 'normalBand',
      z: 0,
    };

    const normalBandUpperSeries: SeriesOption = {
      name: 'Normal range upper',
      type: 'line',
      data: p75.map((p, i) => [p.ageMonths, p.value - p25[i].value]),
      lineStyle: { opacity: 0 },
      areaStyle: { color: NORMAL_BAND_BG, opacity: 1 },
      symbol: 'none',
      silent: true,
      emphasis: { disabled: true },
      stack: 'normalBand',
      z: 0,
    };

    // Patient data series
    const patientLineSeries: SeriesOption = {
      name: 'Patient',
      type: 'line',
      data: patientSeries.map(p => ({
        value: [p.age, p.val],
        percentile: p.pct?.percentile,
        zScore: p.pct?.zScore,
        recordedAt: p.recordedAt,
      })),
      lineStyle: { color: PATIENT_COLOR, width: 2.5 },
      itemStyle: { color: PATIENT_COLOR, borderColor: '#fff', borderWidth: 2 },
      symbolSize: 10,
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: `${PATIENT_COLOR}55` },
      },
      z: 10,
    };

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 500,
      grid: { left: 56, right: 56, top: 24, bottom: 48 },
      xAxis: {
        type: 'value',
        min: 0,
        max: 60,
        interval: 6,
        name: 'Age (months)',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: { fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.4 } },
      },
      yAxis: {
        type: 'value',
        name: meta.yAxisLabel,
        nameLocation: 'middle',
        nameGap: 44,
        axisLabel: {
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          formatter: (v: number) => v.toFixed(meta.precision === 2 ? 1 : 0),
        },
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.4 } },
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params: any) => {
          // Only show detailed tooltip for patient series
          if (params.seriesName !== 'Patient') return '';
          const age   = params.value[0];
          const val   = params.value[1];
          const pct   = params.data?.percentile;
          const z     = params.data?.zScore;
          const date  = params.data?.recordedAt
            ? new Date(params.data.recordedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : '';
          const cls   = z != null ? classifyZScore(z) : null;

          return `
            <div style="font-family:Inter,sans-serif;min-width:160px;padding:2px">
              <div style="font-weight:700;margin-bottom:6px">${age} months${date ? ` · ${date}` : ''}</div>
              <div style="display:flex;justify-content:space-between;gap:16px;color:#666">
                <span>${meta.label}</span>
                <span style="font-family:monospace;font-weight:600;color:#1a1a1a">${val.toFixed(meta.precision)} ${meta.unit}</span>
              </div>
              ${pct != null ? `<div style="display:flex;justify-content:space-between;gap:16px;color:#666;margin-top:3px">
                <span>Percentile</span>
                <span style="font-family:monospace;font-weight:600;color:${PATIENT_COLOR}">${pct}th</span>
              </div>` : ''}
              ${z != null ? `<div style="display:flex;justify-content:space-between;gap:16px;color:#666;margin-top:3px">
                <span>Z-score</span>
                <span style="font-family:monospace;font-weight:600;color:#1a1a1a">${z.toFixed(2)}</span>
              </div>` : ''}
              ${cls ? `<div style="margin-top:8px">
                <span style="background:${cls.bg};color:${cls.color};padding:2px 9px;border-radius:999px;font-size:0.72rem;font-weight:700">${cls.label}</span>
              </div>` : ''}
            </div>`;
        },
      },
      legend: {
        data: REFERENCE_PERCENTILES.map(p => p.label),
        bottom: 0,
        itemWidth: 20,
        itemHeight: 2,
        textStyle: { fontSize: 11, fontFamily: 'Inter, sans-serif' },
        formatter: (name: string) => name,
      },
      series: [
        normalBandSeries,
        normalBandUpperSeries,
        ...refSeries,
        patientLineSeries,
      ],
    };
  }, [refCurves, patientSeries, meta]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleMetric = useCallback((m: GrowthMetric) => setMetric(m), []);
  const handleSex    = useCallback((s: Sex)          => setSex(s),    []);

  const METRICS: { key: GrowthMetric; label: string }[] = [
    { key: 'weight', label: 'Weight'     },
    { key: 'height', label: 'Height'     },
    { key: 'head',   label: 'Head Circ.' },
    { key: 'bmi',    label: 'BMI'        },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="gc-root">
      {/* Controls */}
      <div className="gc-controls">
        {/* Metric tabs */}
        <div className="gc-tabs" role="tablist">
          {METRICS.map(m => (
            <button
              key={m.key}
              role="tab"
              aria-selected={metric === m.key}
              className={`gc-tab${metric === m.key ? ' gc-tab--active' : ''}`}
              onClick={() => handleMetric(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Sex toggle */}
        <div className="gc-sex-toggle" aria-label="Reference standard sex">
          <button
            className={`gc-sex-btn${sex === 'MALE' ? ' gc-sex-btn--male' : ''}`}
            onClick={() => handleSex('MALE')}
          >
            ♂ Boys
          </button>
          <button
            className={`gc-sex-btn${sex === 'FEMALE' ? ' gc-sex-btn--female' : ''}`}
            onClick={() => handleSex('FEMALE')}
          >
            ♀ Girls
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="gc-chart-wrap">
        {patientSeries.length === 0 ? (
          <div className="gc-empty">No {meta.label.toLowerCase()} measurements recorded yet.</div>
        ) : (
          <ReactECharts
            option={option}
            style={{ height: chartHeight }}
            notMerge
            lazyUpdate={false}
          />
        )}
      </div>

      {/* Stats bar */}
      {latestStat && (
        <div className="gc-stats">
          <div className="gc-stat">
            <span className="gc-stat__label">Latest</span>
            <span className="gc-stat__value">
              {latestStat.val.toFixed(meta.precision)}
              <span className="gc-stat__unit">{meta.unit}</span>
            </span>
            <span className="gc-stat__sub">age {latestStat.age} months</span>
          </div>

          {latestStat.pct && (
            <>
              <div className="gc-stat">
                <span className="gc-stat__label">Percentile</span>
                <span className="gc-stat__value" style={{ color: latestStat.cls?.color }}>
                  {latestStat.pct.percentile}
                  <span className="gc-stat__unit">th</span>
                </span>
                {latestStat.cls && (
                  <span
                    className="gc-stat__badge"
                    style={{ background: latestStat.cls.bg, color: latestStat.cls.color }}
                  >
                    {latestStat.cls.label}
                  </span>
                )}
              </div>

              <div className="gc-stat">
                <span className="gc-stat__label">Z-score</span>
                <span className="gc-stat__value">{latestStat.pct.zScore.toFixed(2)}</span>
                <span className="gc-stat__sub">SD from median</span>
              </div>
            </>
          )}

          <div className="gc-stat">
            <span className="gc-stat__label">Measurements</span>
            <span className="gc-stat__value">{patientSeries.length}</span>
            <span className="gc-stat__sub">
              {patientSeries[0].age}–{patientSeries[patientSeries.length - 1].age} mo range
            </span>
          </div>
        </div>
      )}

      <style>{`
        .gc-root {
          font-family: Inter, system-ui, sans-serif;
          background: var(--card-bg, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 12px;
          overflow: hidden;
        }
        .gc-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 18px;
          border-bottom: 1px solid var(--border, #e5e7eb);
          flex-wrap: wrap;
        }
        .gc-tabs {
          display: flex;
          gap: 2px;
          background: var(--muted-bg, #f3f4f6);
          border-radius: 8px;
          padding: 3px;
        }
        .gc-tab {
          padding: 6px 14px;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-muted, #6b7280);
          border: none;
          background: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .gc-tab--active {
          background: var(--card-bg, #fff);
          color: var(--text, #111827);
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .gc-tab:hover:not(.gc-tab--active) {
          color: var(--text, #111827);
          background: rgba(0,0,0,0.04);
        }
        .gc-sex-toggle {
          display: flex;
          gap: 2px;
          background: var(--muted-bg, #f3f4f6);
          border-radius: 8px;
          padding: 3px;
        }
        .gc-sex-btn {
          padding: 6px 14px;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-muted, #6b7280);
          border: none;
          background: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .gc-sex-btn--male {
          background: #EBF3FF;
          color: #1565C0;
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .gc-sex-btn--female {
          background: #FDF2F8;
          color: #C2185B;
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .gc-sex-btn:hover:not(.gc-sex-btn--male):not(.gc-sex-btn--female) {
          color: var(--text, #111827);
          background: rgba(0,0,0,0.04);
        }
        .gc-chart-wrap {
          padding: 8px 4px 0;
        }
        .gc-loader, .gc-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: var(--text-muted, #6b7280);
          font-size: 0.875rem;
        }
        .gc-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid var(--border, #e5e7eb);
          border-top-color: #1565C0;
          border-radius: 50%;
          animation: gc-spin 0.7s linear infinite;
        }
        @keyframes gc-spin { to { transform: rotate(360deg); } }
        .gc-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          border-top: 1px solid var(--border, #e5e7eb);
        }
        .gc-stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 14px 18px;
          border-right: 1px solid var(--border, #e5e7eb);
        }
        .gc-stat:last-child { border-right: none; }
        .gc-stat__label {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted, #6b7280);
        }
        .gc-stat__value {
          font-size: 1.5rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
          color: var(--text, #111827);
          line-height: 1.1;
        }
        .gc-stat__unit {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-muted, #6b7280);
          margin-left: 2px;
        }
        .gc-stat__sub {
          font-size: 0.75rem;
          color: var(--text-muted, #6b7280);
        }
        .gc-stat__badge {
          display: inline-flex;
          align-self: flex-start;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 700;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}

export default GrowthChart;
