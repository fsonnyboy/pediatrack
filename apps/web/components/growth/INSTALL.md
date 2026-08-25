# Growth Chart — install & navigation

## 1. Install the dependency

```bash
cd apps/web
npm install echarts echarts-for-react
```

(or from the repo root: `npm install echarts echarts-for-react -w @peditrack/web`)

## 2. File placement

Everything goes under **`apps/web/`** — matching the Turborepo layout:

```
apps/web/
├── components/growth/
│   ├── growth-lms.ts          ← WHO LMS tables + math
│   └── GrowthChart.tsx        ← the ECharts component
├── hooks/
│   └── useGrowthChart.ts      ← wraps patientsApi.growthChart()
└── app/patients/[id]/growth/
    ├── page.tsx               ← route: /patients/:id/growth
    └── GrowthChartPageClient.tsx
```

The hook imports `@/lib/queries` and `@/components/growth/GrowthChart`, so your
`tsconfig.json` needs the `@/*` path alias pointing at `apps/web/`. If it doesn't
already:

```jsonc
// apps/web/tsconfig.json
{
  "compilerOptions": {
    "paths": { "@/*": ["./*"] }
  }
}
```

## 3. Reaching the chart

Once the files are in place the route exists immediately:

```
/patients/<patient-id>/growth
```

Nothing links to it yet. Pick whichever of these fits your patient detail page.

### Option A — a tab on the patient detail page

If the patient page uses tabs (Overview / Appointments / Vaccinations / …),
add one more entry pointing at the growth route:

```tsx
import Link from 'next/link';

const TABS = [
  { href: '',              label: 'Overview'      },
  { href: '/appointments', label: 'Appointments'  },
  { href: '/vaccinations', label: 'Vaccinations'  },
  { href: '/prescriptions',label: 'Prescriptions' },
  { href: '/growth',       label: 'Growth'        },  // ← add
];

// inside the component:
{TABS.map(t => (
  <Link key={t.href} href={`/patients/${patientId}${t.href}`}>
    {t.label}
  </Link>
))}
```

### Option B — a button on the patient header

```tsx
import Link from 'next/link';

<Link href={`/patients/${patient.id}/growth`} className="btn btn-secondary">
  📈 Growth Chart
</Link>
```

### Option C — embed it inline, no separate route

Skip the route entirely and drop the component straight into the patient
detail page:

```tsx
'use client';
import { useGrowthChart } from '@/hooks/useGrowthChart';
import { GrowthChart } from '@/components/growth/GrowthChart';

function PatientGrowthSection({ patientId }: { patientId: string }) {
  const { data, isLoading } = useGrowthChart(patientId);
  if (isLoading || !data) return null;
  return <GrowthChart data={data} chartHeight={420} />;
}
```

## 4. Backend prerequisite

The route calls `GET /api/v1/patients/:id/growth-chart`, which already exists in
`apps/api/src/modules/patients/patients.controller.ts` (line 69). Make sure the
patched `patients.service.ts` from the growth-percentiles zip is applied — it's
what adds the `sex` field and per-point `percentiles` to the response.

## 5. Verify

```bash
npm run dev
```

Then open `http://localhost:3000/patients/<id>/growth` for a patient that has
recorded vitals. A patient with no vitals shows the empty state rather than an
error.
