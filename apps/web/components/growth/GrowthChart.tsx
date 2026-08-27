'use client';

/**
 * GrowthChart — interactive WHO 2006 growth chart (Apache ECharts).
 *
 * Mirrors the published design reference: header with patient badge, a
 * two-column layout (chart card + side rail), shaded percentile bands,
 * seven reference curves with end labels, a custom legend, a four-stat
 * summary bar, a classification guide, and a measurement history table.
 *
 * Install once:  npm install echarts echarts-for-react
 *
 * `data` is the JSON from GET /api/v1/patients/:id/growth-chart
 * (PatientsService.getGrowthChart).
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

// ECharts touches window/document — keep it out of SSR.
const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => (
    <div className="gc-loader"><div className="gc-spinner" /></div>
  ),
});

// ── API shape ─────────────────────────────────────────────────────────────────

export interface GrowthPoint {
  recordedAt: string;
  /** Plotting age — corrected for prematurity when the patient is preterm and under ~24mo. */
  ageMonths: number;
  /** Age since birth, unadjusted. Differs from ageMonths only when ageBasisUsed is CORRECTED. */
  chronologicalAgeMonths?: number;
  ageBasisUsed?: 'CHRONOLOGICAL' | 'CORRECTED';
  weightKg: number | null;
  heightCm: number | null;
  headCircumference: number | null;
  bmi: number | null;
}

export interface GrowthChartData {
  patientId: string;
  sex: Sex;
  /** True when the patient's gender is OTHER and boys' standards were used. */
  sexInferred?: boolean;
  dateOfBirth: string;
  gestationalAge?: number | null;
  isPreterm?: boolean;
  points: GrowthPoint[];
}

const VALUE_OF: Record<GrowthMetric, (p: GrowthPoint) => number | null> = {
  weight: (p) => p.weightKg,
  height: (p) => p.heightCm,
  head:   (p) => p.headCircumference,
  bmi:    (p) => p.bmi,
};

const METRICS: { key: GrowthMetric; label: string }[] = [
  { key: 'weight', label: 'Weight' },
  { key: 'height', label: 'Height' },
  { key: 'head',   label: 'Head Circ.' },
  { key: 'bmi',    label: 'BMI' },
];

/** Seven bands between the reference curves, matching the design reference. */
const BANDS: { lo: number; hi: number; tone: 'severe' | 'low' | 'normal' }[] = [
  { lo: 0, hi: 1, tone: 'severe' }, // 3rd  → 10th
  { lo: 1, hi: 2, tone: 'low'    }, // 10th → 25th
  { lo: 2, hi: 4, tone: 'normal' }, // 25th → 75th
  { lo: 4, hi: 5, tone: 'low'    }, // 75th → 90th
  { lo: 5, hi: 6, tone: 'severe' }, // 90th → 97th
];

const BAND_FILL = {
  severe: 'rgba(232, 83, 74, 0.07)',
  low:    'rgba(240, 162, 42, 0.07)',
  normal: 'rgba(42, 157, 143, 0.07)',
};

const PATIENT_COLOR = '#E55A22';

/** Classification rows for the side rail. */
const GUIDE = [
  { label: 'Severely high', range: '> 97th',    color: '#E8534A' },
  { label: 'High',          range: '90th–97th', color: '#F0A22A' },
  { label: 'Normal-high',   range: '75th–90th', color: '#A6C96A' },
  { label: 'Normal',        range: '25th–75th', color: '#2A9D8F' },
  { label: 'Normal-low',    range: '10th–25th', color: '#A6C96A' },
  { label: 'Low',           range: '3rd–10th',  color: '#F0A22A' },
  { label: 'Severely low',  range: '< 3rd',     color: '#E8534A' },
];

function pctColor(p: number): string {
  if (p < 3  || p > 97) return '#E8534A';
  if (p < 10 || p > 90) return '#F0A22A';
  if (p < 25 || p > 75) return '#7BBD6E';
  return '#2A9D8F';
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  data: GrowthChartData;
  /** Shown in the header badge. Falls back to the MRN or "Patient". */
  patientName?: string;
  chartHeight?: number;
}

export function GrowthChart({ data, patientName, chartHeight = 380 }: Props) {
  const [metric, setMetric] = useState<GrowthMetric>('weight');
  const [sex, setSex]       = useState<Sex>(data.sex ?? 'MALE');

  const meta = METRIC_META[metric];

  const series = useMemo(() => {
    const extract = VALUE_OF[metric];
    return data.points
      .map((pt) => {
        const val = extract(pt);
        if (val == null) return null;
        return {
          age: pt.ageMonths,
          val,
          pct: computePercentile(metric, sex, pt.ageMonths, val),
          recordedAt: pt.recordedAt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [data.points, metric, sex]);

  const curves = useMemo(
    () => REFERENCE_PERCENTILES.map((p) => ({
      ...p,
      points: buildReferenceCurve(metric, sex, p.z),
    })),
    [metric, sex],
  );

  const latest = useMemo(() => {
    if (!series.length) return null;
    const last = series[series.length - 1];
    const prev = series.length > 1 ? series[series.length - 2] : null;
    const gain = prev && last.age !== prev.age
      ? (last.val - prev.val) / (last.age - prev.age)
      : null;
    return { ...last, cls: last.pct ? classifyZScore(last.pct.zScore) : null, gain };
  }, [series]);

  // ── ECharts option ────────────────────────────────────────────────────────
  const option: EChartsOption = useMemo(() => {
    const ages = curves[0].points.map((p) => p.ageMonths);

    // Shaded bands, built as a stack: an invisible base at the 3rd percentile,
    // then each band stacked as the delta to the curve above it.
    const bandSeries: SeriesOption[] = [
      {
        name: '__bandBase',
        type: 'line',
        data: curves[0].points.map((p) => [p.ageMonths, p.value]),
        lineStyle: { opacity: 0 },
        symbol: 'none',
        silent: true,
        stack: 'bands',
        z: 0,
      },
      ...BANDS.map((b, i): SeriesOption => ({
        name: `__band${i}`,
        type: 'line',
        data: ages.map((age, k) => [
          age,
          curves[b.hi].points[k].value - curves[b.lo].points[k].value,
        ]),
        lineStyle: { opacity: 0 },
        areaStyle: { color: BAND_FILL[b.tone] },
        symbol: 'none',
        silent: true,
        stack: 'bands',
        z: 0,
      })),
    ];

    const refSeries: SeriesOption[] = curves.map((c): SeriesOption => ({
      name: c.label,
      type: 'line',
      data: c.points.map((p) => [p.ageMonths, p.value]),
      lineStyle: {
        color: c.color,
        width: c.width,
        type: c.dashType.length ? c.dashType : 'solid',
        opacity: 0.85,
      },
      symbol: 'none',
      silent: true,
      // Right-edge percentile label, as in the design reference.
      endLabel: {
        show: true,
        formatter: c.label,
        color: c.color,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'var(--font-sans), Inter, system-ui, sans-serif',
        offset: [4, 0],
      },
      z: 2,
    }));

    const patientSeries: SeriesOption = {
      name: 'Patient',
      type: 'line',
      data: series.map((p) => ({
        value: [p.age, p.val],
        percentile: p.pct?.percentile,
        zScore: p.pct?.zScore,
        recordedAt: p.recordedAt,
      })),
      lineStyle: { color: PATIENT_COLOR, width: 2.5 },
      itemStyle: { color: PATIENT_COLOR, borderColor: '#fff', borderWidth: 2.5 },
      symbol: 'circle',
      symbolSize: 11,
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(229,90,34,0.45)' } },
      z: 10,
    };

    return {
      backgroundColor: 'transparent',
      animationDuration: 450,
      grid: { left: 54, right: 46, top: 18, bottom: 44 },
      xAxis: {
        type: 'value',
        min: 0,
        max: 60,
        interval: 6,
        name: 'Age (months)',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { fontSize: 11, fontFamily: 'var(--font-sans), Inter, sans-serif' },
        axisLabel: { fontSize: 10, fontFamily: 'var(--font-mono), ui-monospace, monospace' },
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.35 } },
      },
      yAxis: {
        type: 'value',
        scale: true,
        name: meta.yAxisLabel,
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { fontSize: 11, fontFamily: 'var(--font-sans), Inter, sans-serif' },
        axisLabel: {
          fontSize: 10,
          fontFamily: 'var(--font-mono), ui-monospace, monospace',
          formatter: (v: number) => v.toFixed(1),
        },
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.35 } },
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        borderWidth: 0,
        padding: 0,
        backgroundColor: 'transparent',
        formatter: (params: any) => {
          if (params.seriesName !== 'Patient') return '';
          const [age, val] = params.value;
          const { percentile: pct, zScore: z, recordedAt } = params.data ?? {};
          const cls = z != null ? classifyZScore(z) : null;
          const date = recordedAt
            ? new Date(recordedAt).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric',
              })
            : '';
          const row = (k: string, v: string, c: string) =>
            `<div style="display:flex;justify-content:space-between;gap:18px;margin-top:3px">
               <span style="color:var(--gc-text-2)">${k}</span>
               <span style="font-family:var(--font-mono),ui-monospace,monospace;font-weight:600;color:${c}">${v}</span>
             </div>`;
          return `
            <div class="gc-tip">
              <div class="gc-tip__h">${age} months${date ? ` · ${date}` : ''}</div>
              ${row(meta.label, `${val.toFixed(meta.precision)} ${meta.unit}`, 'var(--gc-text)')}
              ${pct != null ? row('Percentile', `${pct}th`, PATIENT_COLOR) : ''}
              ${z != null ? row('Z-score', z.toFixed(2), 'var(--gc-text)') : ''}
              ${cls ? `<div style="margin-top:8px"><span style="background:${cls.bg};color:${cls.color};padding:2px 9px;border-radius:999px;font-size:.7rem;font-weight:700">${cls.label}</span></div>` : ''}
            </div>`;
        },
      },
      series: [...bandSeries, ...refSeries, patientSeries],
    };
  }, [curves, series, meta]);

  const selectMetric = useCallback((m: GrowthMetric) => setMetric(m), []);
  const selectSex    = useCallback((s: Sex) => setSex(s), []);

  const latestAge = data.points.length
    ? Math.floor(data.points[data.points.length - 1].ageMonths)
    : null;

  return (
    <div className="gc">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="gc-head">
        <div className="gc-head__left">
          <div className="gc-logo" aria-hidden="true">📈</div>
          <div>
            <h2 className="gc-title">Growth Chart</h2>
            <p className="gc-sub">WHO 2006 Child Growth Standards · Ages 0–60 months</p>
          </div>
        </div>
      </header>

      {data.sexInferred && (
        <p className="gc-note">
          This patient&rsquo;s gender is recorded as <strong>Other</strong>. WHO publishes
          separate standards for boys and girls only, so percentiles are charted against
          the {sex === 'MALE' ? 'boys' : 'girls'}&rsquo; standard — interpret with care.
        </p>
      )}

      {data.isPreterm && (
        <p className="gc-note">
          Born at <strong>{data.gestationalAge} weeks</strong> gestation. Points before roughly
          24 months are plotted on <strong>corrected age</strong> (adjusted for prematurity),
          not age since birth — otherwise normal catch-up growth reads as faltering.
        </p>
      )}

      {/* ── Two-column body ────────────────────────────────────── */}
      <div className="gc-body">
        {/* Main chart card */}
        <section className="gc-card">
          <div className="gc-controls">
            <div className="gc-tabs" role="tablist" aria-label="Growth metric">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  role="tab"
                  aria-selected={metric === m.key}
                  className={`gc-tab${metric === m.key ? ' is-active' : ''}`}
                  onClick={() => selectMetric(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="gc-sex" aria-label="Reference standard">
              <button
                className={`gc-sexbtn${sex === 'MALE' ? ' is-male' : ''}`}
                onClick={() => selectSex('MALE')}
              >♂ Boys</button>
              <button
                className={`gc-sexbtn${sex === 'FEMALE' ? ' is-female' : ''}`}
                onClick={() => selectSex('FEMALE')}
              >♀ Girls</button>
            </div>
          </div>

          <div className="gc-chart">
            {series.length === 0 ? (
              <div className="gc-empty">
                No {meta.label.toLowerCase()} measurements recorded yet.
              </div>
            ) : (
              <ReactECharts option={option} style={{ height: chartHeight }} notMerge lazyUpdate={false} />
            )}
          </div>

          <div className="gc-legend">
            <span className="gc-lg"><i className="gc-lg__dot" /> Patient data</span>
            <span className="gc-lg"><i className="gc-lg__ln" style={{ background: '#2A9D8F' }} /> 50th (median)</span>
            <span className="gc-lg"><i className="gc-lg__ln" style={{ background: '#A6C96A' }} /> 25th / 75th</span>
            <span className="gc-lg"><i className="gc-lg__ln" style={{ background: '#F0A22A' }} /> 10th / 90th</span>
            <span className="gc-lg"><i className="gc-lg__ln" style={{ background: '#E8534A' }} /> 3rd / 97th</span>
          </div>

          {latest && (
            <div className="gc-stats">
              <div className="gc-stat">
                <span className="gc-stat__k">Latest value</span>
                <span className="gc-stat__v">{latest.val.toFixed(meta.precision)}</span>
                <span className="gc-stat__s">{meta.unit} · age {latest.age} mo</span>
              </div>
              {latest.pct && (
                <>
                  <div className="gc-stat">
                    <span className="gc-stat__k">Percentile</span>
                    <span className="gc-stat__v" style={{ color: pctColor(latest.pct.percentile) }}>
                      {latest.pct.percentile}
                    </span>
                    {latest.cls && (
                      <span className="gc-pill" style={{ background: latest.cls.bg, color: latest.cls.color }}>
                        {latest.cls.label}
                      </span>
                    )}
                  </div>
                  <div className="gc-stat">
                    <span className="gc-stat__k">Z-score</span>
                    <span className="gc-stat__v gc-stat__v--sm">{latest.pct.zScore.toFixed(2)}</span>
                    <span className="gc-stat__s">SD from median</span>
                  </div>
                </>
              )}
              {latest.gain != null && (
                <div className="gc-stat">
                  <span className="gc-stat__k">Monthly gain</span>
                  <span className="gc-stat__v gc-stat__v--sm">
                    {latest.gain >= 0 ? '+' : ''}{latest.gain.toFixed(2)}
                  </span>
                  <span className="gc-stat__s">{meta.unit}/month</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Side rail */}
        <aside className="gc-rail">
          <div className="gc-panel">
            <h3>Classification Guide</h3>
            {GUIDE.map((g) => (
              <div className="gc-ref" key={g.label}>
                <i className="gc-ref__sw" style={{ background: g.color }} />
                <span className="gc-ref__l">{g.label}</span>
                <span className="gc-ref__r">{g.range}</span>
              </div>
            ))}
          </div>

          <div className="gc-panel">
            <h3>Measurement History</h3>
            {series.length === 0 ? (
              <p className="gc-ref__r">No measurements yet.</p>
            ) : (
              <div className="gc-tablewrap">
                <table className="gc-table">
                  <thead>
                    <tr><th>Age</th><th>Value</th><th>%ile</th></tr>
                  </thead>
                  <tbody>
                    {[...series].reverse().map((p) => (
                      <tr key={`${p.age}-${p.recordedAt}`}>
                        <td>{p.age} mo</td>
                        <td>{p.val.toFixed(meta.precision)} {meta.unit}</td>
                        <td>
                          {p.pct ? (
                            <span
                              className="gc-pill gc-pill--sm"
                              style={{
                                background: `${pctColor(p.pct.percentile)}22`,
                                color: pctColor(p.pct.percentile),
                              }}
                            >
                              {p.pct.percentile}th
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </aside>
      </div>

      <style jsx global>{`
        .gc {
          /* Palette from the design reference. Scoped so it cannot leak into
             the surrounding dashboard theme. */
          --gc-surface:  #FFFFFF;
          --gc-surface2: #F6FAFD;
          --gc-border:   #D8E6EF;
          --gc-text:     #1A3448;
          --gc-text-2:   #4A6580;
          --gc-text-3:   #7A9BB8;
          --gc-accent:   #1565C0;
          --gc-accent-l: #E3EEF9;
          --gc-shadow:   0 1px 4px rgba(0,0,0,.07), 0 4px 16px rgba(0,0,0,.05);

          font-family: var(--font-sans), Inter, system-ui, -apple-system, sans-serif;
          color: var(--gc-text);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        [data-theme='dark'] .gc, .dark .gc {
          --gc-surface: #132437; --gc-surface2: #0F1E2E; --gc-border: #1E3651;
          --gc-text: #DAEAF5; --gc-text-2: #7AAAC8; --gc-text-3: #3E6B8A;
          --gc-accent: #4D9FEC; --gc-accent-l: #0D2A44;
          --gc-shadow: 0 1px 4px rgba(0,0,0,.3), 0 4px 16px rgba(0,0,0,.25);
        }

        .gc-head { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .gc-head__left { display:flex; align-items:center; gap:12px; }
        .gc-logo { width:36px; height:36px; border-radius:9px; background:var(--gc-accent); display:grid; place-items:center; font-size:18px; flex-shrink:0; }
        .gc-title { font-size:1.15rem; font-weight:700; letter-spacing:-.01em; margin:0; color:var(--gc-text); }
        .gc-sub { font-size:.8rem; color:var(--gc-text-2); margin:1px 0 0; }
        .gc-badge { display:flex; align-items:center; gap:8px; padding:7px 14px; background:var(--gc-surface);
                    border:1px solid var(--gc-border); border-radius:999px; font-size:.8rem; color:var(--gc-text-2); box-shadow:var(--gc-shadow); }
        .gc-badge strong { color:var(--gc-text); font-weight:600; }
        .gc-age { background:var(--gc-accent-l); color:var(--gc-accent); font-size:.72rem; font-weight:600; padding:2px 8px; border-radius:999px; }

        .gc-note { font-size:.78rem; color:var(--gc-text-2); background:var(--gc-surface2);
                   border:1px solid var(--gc-border); border-left:3px solid #F0A22A;
                   border-radius:8px; padding:9px 13px; margin:0; }

        .gc-body { display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:16px; align-items:start; }
        @media (max-width:900px) { .gc-body { grid-template-columns:1fr; } }

        .gc-card, .gc-panel { background:var(--gc-surface); border:1px solid var(--gc-border);
                              border-radius:14px; box-shadow:var(--gc-shadow); }
        .gc-card { overflow:hidden; }
        .gc-rail { display:flex; flex-direction:column; gap:14px; }
        .gc-panel { padding:18px; }
        .gc-panel h3 { font-size:.75rem; font-weight:700; color:var(--gc-text-3);
                       text-transform:uppercase; letter-spacing:.05em; margin:0 0 14px; }

        .gc-controls { display:flex; align-items:center; justify-content:space-between; gap:12px;
                       padding:16px 20px; border-bottom:1px solid var(--gc-border); flex-wrap:wrap; }
        .gc-tabs, .gc-sex { display:flex; gap:2px; background:var(--gc-surface2);
                            border:1px solid var(--gc-border); border-radius:8px; padding:3px; }
        .gc-tab, .gc-sexbtn { padding:6px 14px; font-size:.8rem; font-weight:500; color:var(--gc-text-2);
                              border:none; background:none; border-radius:6px; cursor:pointer;
                              transition:all .15s; white-space:nowrap; font-family:inherit; }
        .gc-tab.is-active { background:var(--gc-surface); color:var(--gc-text); font-weight:600; box-shadow:0 1px 4px rgba(0,0,0,.1); }
        .gc-tab:hover:not(.is-active), .gc-sexbtn:hover:not(.is-male):not(.is-female) { color:var(--gc-text); background:rgba(128,128,128,.08); }
        .gc-sexbtn.is-male { background:#EBF2FF; color:#1565C0; font-weight:600; box-shadow:0 1px 4px rgba(0,0,0,.1); }
        .gc-sexbtn.is-female { background:#FDEEF4; color:#C2185B; font-weight:600; box-shadow:0 1px 4px rgba(0,0,0,.1); }
        [data-theme='dark'] .gc-sexbtn.is-male, .dark .gc-sexbtn.is-male { background:#0D2040; }
        [data-theme='dark'] .gc-sexbtn.is-female, .dark .gc-sexbtn.is-female { background:#2D0E1F; }

        .gc-chart { padding:16px 12px 0; }
        .gc-loader, .gc-empty { display:flex; align-items:center; justify-content:center; height:220px;
                                color:var(--gc-text-2); font-size:.85rem; }
        .gc-spinner { width:28px; height:28px; border:3px solid var(--gc-border); border-top-color:var(--gc-accent);
                      border-radius:50%; animation:gc-spin .7s linear infinite; }
        @keyframes gc-spin { to { transform:rotate(360deg); } }
        @media (prefers-reduced-motion:reduce) { .gc-spinner { animation-duration:2s; } }

        .gc-legend { display:flex; flex-wrap:wrap; gap:12px 20px; align-items:center;
                     padding:14px 20px; border-top:1px solid var(--gc-border); }
        .gc-lg { display:flex; align-items:center; gap:6px; font-size:.73rem; color:var(--gc-text-2); }
        .gc-lg__dot { width:8px; height:8px; border-radius:50%; background:${PATIENT_COLOR}; }
        .gc-lg__ln { width:22px; height:2px; border-radius:2px; }

        .gc-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
                    gap:1px; background:var(--gc-border); border-top:1px solid var(--gc-border); }
        .gc-stat { background:var(--gc-surface); padding:16px 20px; display:flex; flex-direction:column; gap:4px; }
        .gc-stat__k { font-size:.7rem; font-weight:600; color:var(--gc-text-3); text-transform:uppercase; letter-spacing:.04em; }
        .gc-stat__v { font-size:1.5rem; font-weight:700; font-variant-numeric:tabular-nums;
                      letter-spacing:-.03em; color:var(--gc-text); line-height:1.1; }
        .gc-stat__v--sm { font-size:1.25rem; }
        .gc-stat__s { font-size:.75rem; color:var(--gc-text-2); }
        .gc-pill { display:inline-flex; align-self:flex-start; padding:2px 9px; border-radius:999px;
                   font-size:.7rem; font-weight:700; }
        .gc-pill--sm { font-size:.68rem; padding:1px 7px; }

        .gc-ref { display:flex; align-items:center; gap:8px; margin-bottom:8px; font-size:.78rem; }
        .gc-ref__sw { width:10px; height:10px; border-radius:2px; flex-shrink:0; }
        .gc-ref__l { color:var(--gc-text); font-weight:500; flex:1; }
        .gc-ref__r { color:var(--gc-text-2); font-size:.72rem; }

        .gc-tablewrap { overflow-x:auto; }
        .gc-table { width:100%; border-collapse:collapse; font-size:.8rem; }
        .gc-table th { text-align:left; font-size:.7rem; font-weight:600; color:var(--gc-text-3);
                       text-transform:uppercase; letter-spacing:.04em; padding:0 10px 8px 0;
                       border-bottom:1px solid var(--gc-border); }
        .gc-table td { padding:8px 10px 8px 0; border-bottom:1px solid var(--gc-border);
                       color:var(--gc-text-2); font-family:var(--font-mono),ui-monospace,monospace;
                       font-size:.76rem; font-variant-numeric:tabular-nums; white-space:nowrap; }
        .gc-table td:first-child { font-family:var(--font-sans),Inter,sans-serif; color:var(--gc-text); font-weight:500; }
        .gc-table tr:last-child td { border-bottom:none; }

        .gc-tip { background:var(--gc-surface); border:1px solid var(--gc-border); border-radius:8px;
                  padding:10px 14px; font-size:.78rem; min-width:150px; color:var(--gc-text);
                  box-shadow:var(--gc-shadow); font-family:var(--font-sans),Inter,sans-serif; }
        .gc-tip__h { font-weight:700; margin-bottom:4px; color:var(--gc-text); }

        .gc button:focus-visible { outline:2px solid var(--gc-accent); outline-offset:2px; }
      `}</style>
    </div>
  );
}

export default GrowthChart;
