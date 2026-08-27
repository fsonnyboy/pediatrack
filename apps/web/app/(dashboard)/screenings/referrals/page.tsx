'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Send, TriangleAlert } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { screeningsApi } from '@/lib/queries';
import { calculateAge, formatDate, fullName } from '@peditrack/utils';
import type { OpenReferral, ReferralStatus, UnaddressedScreening } from '@peditrack/types';
import { ReferralForm } from '@/components/screenings/referral-form';
import { ReferralStatusForm } from '@/components/screenings/referral-status-form';

const REFERRAL_STATUS_BADGE: Record<ReferralStatus, { variant: BadgeProps['variant']; label: string }> = {
  PENDING: { variant: 'warning', label: 'Pending' },
  SCHEDULED: { variant: 'default', label: 'Scheduled' },
  COMPLETED: { variant: 'success', label: 'Completed' },
  DECLINED: { variant: 'neutral', label: 'Declined' },
  LOST: { variant: 'danger', label: 'Lost to follow-up' },
};

export default function ScreeningReferralsPage() {
  const [openingFor, setOpeningFor] = useState<UnaddressedScreening | null>(null);
  const [editingReferral, setEditingReferral] = useState<OpenReferral | null>(null);

  const { data: unaddressed, isLoading: unaddressedLoading } = useQuery<UnaddressedScreening[]>({
    queryKey: ['screenings', 'referrals', 'unaddressed'],
    queryFn: screeningsApi.unaddressedReferrals,
  });

  const { data: open, isLoading: openLoading } = useQuery<OpenReferral[]>({
    queryKey: ['screenings', 'referrals', 'open'],
    queryFn: screeningsApi.openReferrals,
  });

  return (
    <div>
      <Link
        href="/screenings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Screening
      </Link>

      <PageHeader
        title="Referrals"
        description="A REFER outcome that never gets followed up is the failure this page exists to catch."
      />

      <ReferralForm screening={openingFor} onClose={() => setOpeningFor(null)} />
      <ReferralStatusForm referral={editingReferral} onClose={() => setEditingReferral(null)} />

      <div className="space-y-5">
        {/* Unaddressed */}
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-destructive" aria-hidden />
            <CardTitle>No referral on file</CardTitle>
            {!!unaddressed?.length && <Badge variant="danger">{unaddressed.length}</Badge>}
          </CardHeader>
          <CardContent className="p-0">
            {unaddressedLoading ? (
              <div className="space-y-2 p-5">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : !unaddressed?.length ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nothing unaddressed"
                description="Every screening that came back REFER has a referral started."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Screening</TableHead>
                    <TableHead>Administered</TableHead>
                    <TableHead>Concern</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unaddressed.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link href={`/patients/${s.patient.id}`} className="font-medium hover:text-primary">
                          {fullName(s.patient.firstName, s.patient.lastName)}
                        </Link>
                        <p className="tabular text-xs text-muted-foreground">
                          {s.patient.mrn} · {calculateAge(s.patient.dateOfBirth).display}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.instrument.code}</Badge>
                        <span className="ml-2 text-sm">{s.scheduledAgeMonths}mo checkpoint</span>
                      </TableCell>
                      <TableCell className="tabular text-muted-foreground">{formatDate(s.administeredAt)}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {s.concernNote || '—'}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => setOpeningFor(s)}>
                          <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                          Refer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Open referrals */}
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Send className="h-4 w-4 text-accent" aria-hidden />
            <CardTitle>Open referrals</CardTitle>
            {!!open?.length && <Badge variant="warning">{open.length}</Badge>}
          </CardHeader>
          <CardContent className="p-0">
            {openLoading ? (
              <div className="space-y-2 p-5">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : !open?.length ? (
              <EmptyState
                icon={CheckCircle2}
                title="No open referrals"
                description="Nothing is currently pending or scheduled."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Referred to</TableHead>
                    <TableHead>Referred</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {open.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          href={`/patients/${r.administration.patient.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {fullName(r.administration.patient.firstName, r.administration.patient.lastName)}
                        </Link>
                        <p className="tabular text-xs text-muted-foreground">
                          {r.administration.patient.mrn} · {r.administration.instrument.name}
                        </p>
                      </TableCell>
                      <TableCell>{r.referredTo}</TableCell>
                      <TableCell className="tabular text-muted-foreground">{formatDate(r.referredAt)}</TableCell>
                      <TableCell>
                        <Badge variant={REFERRAL_STATUS_BADGE[r.status].variant}>
                          {REFERRAL_STATUS_BADGE[r.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setEditingReferral(r)}>
                          Update
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
