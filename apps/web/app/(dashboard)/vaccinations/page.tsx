'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Syringe } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { vaccinationsApi } from '@/lib/queries';
import { calculateAge, formatDate, fullName } from '@peditrack/utils';

export default function VaccinationsPage() {
  const [days, setDays] = useState(30);

  const { data: due, isLoading } = useQuery<any[]>({
    queryKey: ['vaccinations', 'due-soon', days],
    queryFn: () => vaccinationsApi.dueSoon(days),
  });

  const { data: vaccines } = useQuery({
    queryKey: ['vaccines'],
    queryFn: vaccinationsApi.vaccines,
  });

  const overdue = due?.filter((d) => d.isOverdue) ?? [];
  const upcoming = due?.filter((d) => !d.isOverdue) ?? [];

  return (
    <div>
      <PageHeader
        title="Vaccinations"
        description="Track immunizations and follow up on doses that are due."
        action={
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
        }
      />

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
                  description="Every scheduled dose is up to date."
                />
              ) : (
                <DueTable rows={overdue} showOverdue />
              )}
            </CardContent>
          </Card>

          {/* Upcoming */}
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Syringe className="h-4 w-4 text-accent" aria-hidden />
              <CardTitle>Due soon</CardTitle>
              {upcoming.length > 0 && <Badge variant="warning">{upcoming.length}</Badge>}
            </CardHeader>
            <CardContent className="p-0">
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={Syringe}
                  title="No doses due"
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
              <CardTitle>Vaccine catalogue</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Vaccine</TableHead>
                    <TableHead>Doses</TableHead>
                    <TableHead>First dose at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vaccines?.map((vaccine) => (
                    <TableRow key={vaccine.id}>
                      <TableCell>
                        <Badge variant="outline">{vaccine.code}</Badge>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{vaccine.name}</p>
                        {vaccine.description && (
                          <p className="text-xs text-muted-foreground">{vaccine.description}</p>
                        )}
                      </TableCell>
                      <TableCell className="tabular">{vaccine.totalDoses}</TableCell>
                      <TableCell className="tabular text-muted-foreground">
                        {vaccine.recommendedAgeMonths === 0
                          ? 'At birth'
                          : vaccine.recommendedAgeMonths
                            ? `${vaccine.recommendedAgeMonths} months`
                            : '—'}
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

function DueTable({ rows, showOverdue }: { rows: any[]; showOverdue?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>Vaccine</TableHead>
          <TableHead>Dose</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>{showOverdue ? 'Overdue by' : 'Due in'}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.patient.id}-${row.vaccine.id}-${row.doseNumber}`}>
            <TableCell>
              <Link href={`/patients/${row.patient.id}`} className="font-medium hover:text-primary">
                {fullName(row.patient.firstName, row.patient.lastName)}
              </Link>
              <p className="tabular text-xs text-muted-foreground">
                {row.patient.mrn} · {calculateAge(row.patient.dateOfBirth).display}
              </p>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{row.vaccine.code}</Badge>
              <span className="ml-2 text-sm">{row.vaccine.name}</span>
            </TableCell>
            <TableCell className="tabular">{row.doseNumber}</TableCell>
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
