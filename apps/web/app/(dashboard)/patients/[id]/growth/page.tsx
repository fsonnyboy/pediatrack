import type { Metadata } from 'next';
import { GrowthChartPageClient } from './GrowthChartPageClient';

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Growth Chart | PediTrack',
};

// ── Page (Server Component shell) ─────────────────────────────────────────────
// Data fetching is done client-side via the hook so the chart can react
// to the sex-toggle without a page reload.

interface Props {
  params: { id: string };
}

export default function GrowthChartPage({ params }: Props) {
  return <GrowthChartPageClient patientId={params.id} />;
}
