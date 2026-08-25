'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, CalendarX } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { AppointmentForm } from '@/components/appointments/appointment-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { appointmentsApi } from '@/lib/queries';
import { calculateAge, formatDate, formatTime, fullName, titleCase } from '@peditrack/utils';

export default function AppointmentsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', { status, from, to, page }],
    queryFn: () => appointmentsApi.list({ status, from, to, page, limit: 20 }),
  });

  const appointments = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="Book, confirm and track every visit."
        action={
          <Button onClick={() => setIsFormOpen(true)}>
            <CalendarPlus className="h-4 w-4" />
            Book appointment
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="from" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              From
            </label>
            <Input
              id="from"
              type="date"
              className="w-auto"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label htmlFor="to" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              To
            </label>
            <Input
              id="to"
              type="date"
              className="w-auto"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label htmlFor="status" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Status
            </label>
            <Select
              id="status"
              className="w-auto min-w-[150px]"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No show</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={CalendarX}
            title="No appointments in this range"
            description="Try widening the date range, or book a new appointment."
            action={{ label: 'Book appointment', onClick: () => setIsFormOpen(true) }}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell className="tabular whitespace-nowrap">
                      <Link href={`/appointments/${appointment.id}`} className="font-semibold hover:text-primary">
                        {formatDate(appointment.scheduledAt)}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(appointment.scheduledAt)} · {appointment.durationMinutes} min
                      </p>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/patients/${appointment.patientId}`}
                        className="font-medium hover:text-primary"
                      >
                        {fullName(appointment.patient?.firstName, appointment.patient?.lastName)}
                      </Link>
                      {appointment.patient?.dateOfBirth && (
                        <p className="tabular text-xs text-muted-foreground">
                          {calculateAge(appointment.patient.dateOfBirth).display}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {titleCase(appointment.type)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      Dr. {appointment.doctor?.lastName}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={appointment.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="tabular text-sm text-muted-foreground">
                  Page {meta.page} of {meta.totalPages} · {meta.total} appointments
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
      </Card>

      <AppointmentForm open={isFormOpen} onClose={() => setIsFormOpen(false)} />
    </div>
  );
}
