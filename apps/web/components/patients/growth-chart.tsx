  'use client';

import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

interface GrowthPoint {
  ageMonths: number;
  weightKg?: number | null;
  heightCm?: number | null;
}

export function GrowthChart({ points }: { points: GrowthPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">
          Growth is plotted once at least two visits have recorded measurements.
        </p>
      </div>
    );
  }

  return (
    <div className="h-72 w-full p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="ageMonths"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            label={{
              value: 'Age (months)',
              position: 'insideBottom',
              offset: -4,
              style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' },
            }}
          />
          <YAxis
            yAxisId="weight"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <YAxis
            yAxisId="height"
            orientation="right"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => `${v} months old`}
            formatter={(value, name) => [
              name === 'weightKg' ? `${value} kg` : `${value} cm`,
              name === 'weightKg' ? 'Weight' : 'Height',
            ]}
          />
          <Line
            yAxisId="weight"
            type="monotone"
            dataKey="weightKg"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
          <Line
            yAxisId="height"
            type="monotone"
            dataKey="heightCm"
            stroke="hsl(var(--accent))"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex justify-center gap-5 pb-2 pt-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden /> Weight (kg)
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden /> Height (cm)
        </span>
      </div>
    </div>
  );
}
