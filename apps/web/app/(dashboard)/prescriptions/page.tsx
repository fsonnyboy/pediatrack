'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Pill, TriangleAlert } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { prescriptionsApi } from '@/lib/queries';
import { formatDate, fullName } from '@peditrack/utils';

export default function PrescriptionsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['prescriptions', { status, page }],
    queryFn: () => prescriptionsApi.list({ status, page, limit: 20 }),
  });

  const { data: doseCheckStatus } = useQuery({
    queryKey: ['prescriptions', 'dose-check-status'],
    queryFn: () => prescriptionsApi.doseCheckStatus(),
    staleTime: 60_000,
  });

  const prescriptions = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div>
      {doseCheckStatus && !doseCheckStatus.active && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="text-sm">
            <p className="font-bold">Weight-based dose checking is not running</p>
            <p className="mt-0.5 text-amber-700/90 dark:text-amber-400/90">
              The medicine dose reference table has no active rows, so no prescription is being
              checked against a mg/kg/day range right now. Populate it from a licensed reference
              before relying on this check.
            </p>
          </div>
        </div>
      )}

      <PageHeader
        title="Prescriptions"
        description="Medicines prescribed across the clinic."
        action={
          <Select
            className="w-auto min-w-[150px]"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : prescriptions.length === 0 ? (
        <Card>
          <EmptyState
            icon={Pill}
            title="No prescriptions"
            description="Prescriptions issued during visits will appear here."
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {prescriptions.map((prescription) => (
              <Card key={prescription.id} className="p-5">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/patients/${prescription.patientId}`}
                      className="text-sm font-bold hover:text-primary"
                    >
                      {fullName(prescription.patient?.firstName, prescription.patient?.lastName)}
                    </Link>
                    <p className="tabular mt-0.5 text-xs text-muted-foreground">
                      {prescription.patient?.mrn} · Issued {formatDate(prescription.issuedAt)} · Dr.{' '}
                      {prescription.doctor?.lastName}
                    </p>
                  </div>
                  <StatusBadge status={prescription.status} />
                </div>

                <ul className="divide-y divide-border rounded-lg border border-border">
                  {prescription.items?.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-baseline gap-x-3 px-3.5 py-2.5">
                      <span className="text-sm font-semibold">{item.medicineName}</span>
                      <span className="tabular text-sm text-muted-foreground">
                        {item.dosage} · {item.frequency} · {item.durationDays} days
                      </span>
                      {item.instructions && (
                        <span className="w-full text-xs text-muted-foreground">
                          {item.instructions}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="tabular text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages} · {meta.total} prescriptions
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!meta.hasPreviousPage} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={!meta.hasNextPage} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
