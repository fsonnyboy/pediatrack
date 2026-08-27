'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ClipboardCheck, ChevronRight, Send } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { screeningsApi } from '@/lib/queries';
import { calculateAge, formatDate, fullName } from '@peditrack/utils';
import type { DueScreening, OpenReferral, ScreeningInstrument, UnaddressedScreening } from '@peditrack/types';
import { ScreeningForm } from '@/components/screenings/screening-form';

export default function ScreeningsPage() {
  const [days, setDays] = useState(30);
  const [formOpen, setFormOpen] = useState(false);

  const { data: due, isLoading } = useQuery<DueScreening[]>({
    queryKey: ['screenings', 'due-soon', days],
    queryFn: () => screeningsApi.dueSoon(days),
  });

  const { data: instruments } = useQuery<ScreeningInstrument[]>({
    queryKey: ['screening-instruments'],
    queryFn: screeningsApi.instruments,
  });

  const { data: unaddressed } = useQuery<UnaddressedScreening[]>({
    queryKey: ['screenings', 'referrals', 'unaddressed'],
    queryFn: screeningsApi.unaddressedReferrals,
  });

  const { data: openReferrals } = useQuery<OpenReferral[]>({
    queryKey: ['screenings', 'referrals', 'open'],
    queryFn: screeningsApi.openReferrals,
  });

  const referralAttentionCount = (unaddressed?.length ?? 0) + (openReferrals?.length ?? 0);

  const overdue = due?.filter((d) => d.isOverdue) ?? [];
  const upcoming = due?.filter((d) => !d.isOverdue) ?? [];

  return (
    <div>
      <PageHeader
        title="Developmental screening"
        description="AAP periodicity checkpoints — 9, 18, 24 and 30 months. 18 months requires both a general and an autism-specific screen."
        action={
          <div className="flex items-center gap-2">
            <Select
              className="w-auto"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              aria-label="Look-ahead window"
            >
              <option value={7}>Next 7 days</option>
              <option value={30}>Next 30 days</option>
              <option value={60}>Next 60 days</option>
              <option value={90}>Next 90 days</option>
            </Select>
            <Button onClick={() => setFormOpen(true)}>Record screening</Button>
          </div>
        }
      />

      <ScreeningForm open={formOpen} onClose={() => setFormOpen(false)} />

      <Link href="/screenings/referrals" className="mb-5 block">
        <Card className="transition hover:border-primary/50">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-accent" aria-hidden />
              <span className="text-sm font-semibold">Referrals</span>
              {referralAttentionCount > 0 && (
                <Badge variant={unaddressed?.length ? 'danger' : 'warning'}>{referralAttentionCount}</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {unaddressed?.length
                  ? `${unaddressed.length} REFER outcome${unaddressed.length === 1 ? '' : 's'} with no referral yet`
                  : 'Track REFER outcomes through to follow-up'}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          </CardContent>
        </Card>
      </Link>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Overdue */}
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
              <CardTitle>Overdue</CardTitle>
              {overdue.length > 0 && <Badge variant="danger">{overdue.length}</Badge>}
            </CardHeader>
            <CardContent className="p-0">
              {overdue.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Nothing overdue"
                  description="Every checkpoint due so far has been screened."
                />
              ) : (
                <DueTable rows={overdue} showOverdue />
              )}
            </CardContent>
          </Card>

          {/* Upcoming */}
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-accent" aria-hidden />
              <CardTitle>Due soon</CardTitle>
              {upcoming.length > 0 && <Badge variant="warning">{upcoming.length}</Badge>}
            </CardHeader>
            <CardContent className="p-0">
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No screenings due"
                  description={`Nothing falls due in the next ${days} days.`}
                />
              ) : (
                <DueTable rows={upcoming} />
              )}
            </CardContent>
          </Card>

          {/* Catalogue */}
          <Card>
            <CardHeader>
              <CardTitle>Instrument catalogue</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Age range</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instruments?.map((instrument) => (
                    <TableRow key={instrument.id}>
                      <TableCell>
                        <Badge variant="outline">{instrument.code}</Badge>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{instrument.name}</p>
                        {instrument.cutoffNote && (
                          <p className="text-xs text-muted-foreground">{instrument.cutoffNote}</p>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{instrument.type.toLowerCase()}</TableCell>
                      <TableCell className="tabular text-muted-foreground">
                        {instrument.minAgeMonths}–{instrument.maxAgeMonths} months
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function DueTable({ rows, showOverdue }: { rows: DueScreening[]; showOverdue?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>Screening</TableHead>
          <TableHead>Checkpoint</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>{showOverdue ? 'Overdue by' : 'Due in'}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.patient.id}-${row.instrument.id}-${row.scheduledAgeMonths}`}>
            <TableCell>
              <Link href={`/patients/${row.patient.id}`} className="font-medium hover:text-primary">
                {fullName(row.patient.firstName, row.patient.lastName)}
              </Link>
              <p className="tabular text-xs text-muted-foreground">
                {row.patient.mrn} · {calculateAge(row.patient.dateOfBirth).display}
              </p>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{row.instrument.code}</Badge>
              <span className="ml-2 text-sm">{row.instrument.name}</span>
            </TableCell>
            <TableCell className="tabular">{row.scheduledAgeMonths} mo</TableCell>
            <TableCell className="tabular text-muted-foreground">{formatDate(row.dueDate)}</TableCell>
            <TableCell>
              {showOverdue ? (
                <Badge variant="danger">{row.daysOverdue} days</Badge>
              ) : (
                <Badge variant="warning">{row.daysUntilDue} days</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
