'use client';

import { useEffect, useState } from 'react';
import { useGrowthChart } from '@/hooks/useGrowthChart';
import { patientsApi } from '@/lib/queries';
import { GrowthChart } from '@/components/growth/GrowthChart';

interface Props {
  patientId: string;
}

export function GrowthChartPageClient({ patientId }: Props) {
  const { data, isLoading, error, refetch } = useGrowthChart(patientId);
  const [name, setName] = useState<string | undefined>();

  // The growth-chart endpoint returns measurements, not demographics — fetch the
  // patient separately so the header badge can show a name rather than an id.
  useEffect(() => {
    let cancelled = false;
    patientsApi
      .get(patientId)
      .then((p: any) => {
        if (!cancelled && p) setName(`${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || undefined);
      })
      .catch(() => { /* name is cosmetic — the chart renders fine without it */ });
    return () => { cancelled = true; };
  }, [patientId]);

  if (isLoading) {
    return (
      <div className="gcp-state">
        <div className="gcp-spinner" />
        <p>Loading growth data…</p>
        <style jsx>{`
          .gcp-state { display:flex; flex-direction:column; align-items:center; justify-content:center;
                       min-height:320px; gap:12px; color:#6b7280; font-family:Inter,sans-serif; }
          .gcp-spinner { width:36px; height:36px; border:3px solid #e5e7eb; border-top-color:#1565C0;
                         border-radius:50%; animation:gcp-spin .7s linear infinite; }
          @keyframes gcp-spin { to { transform:rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gcp-state">
        <div className="gcp-icon">⚠️</div>
        <p>Could not load growth data: <strong>{error}</strong></p>
        <button onClick={refetch}>Retry</button>
        <style jsx>{`
          .gcp-state { display:flex; flex-direction:column; align-items:center; justify-content:center;
                       min-height:260px; gap:10px; font-family:Inter,sans-serif; text-align:center; color:#374151; }
          .gcp-icon { font-size:2rem; }
          button { margin-top:4px; padding:8px 18px; background:#1565C0; color:#fff; border:none;
                   border-radius:8px; font-size:.85rem; font-weight:600; cursor:pointer; font-family:inherit; }
          button:hover { background:#1251A3; }
        `}</style>
      </div>
    );
  }

  if (!data) return null;

  return <GrowthChart data={data} patientName={name} chartHeight={400} />;
}
