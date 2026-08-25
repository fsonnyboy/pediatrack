'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, CalendarCheck, CalendarClock, Pill, Syringe, UserPlus, Users,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { dashboardApi } from '@/lib/queries';
import { calculateAge, formatDateTime, fullName } from '@peditrack/utils';
import type { Appointment, DashboardStats, Patient } from '@peditrack/types';

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.stats,
  });

  const { data: upcoming, isLoading: upcomingLoading } = useQuery<Appointment[]>({
    queryKey: ['dashboard', 'upcoming'],
    queryFn: () => dashboardApi.upcoming(7),
  });

  const { data: recent, isLoading: recentLoading } = useQuery<Patient[]>({
    queryKey: ['dashboard', 'recent-patients'],
    queryFn: () => dashboardApi.recentPatients(5),
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Today at a glance — appointments, vaccines due and recent activity."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[118px]" />)
        ) : (
          <>
            <StatCard
              label="Total patients"
              value={stats?.totalPatients ?? 0}
              icon={Users}
              hint={`${stats?.newPatientsThisMonth ?? 0} new this month`}
            />
            <StatCard
              label="Today's appointments"
              value={stats?.appointmentsToday ?? 0}
              icon={CalendarCheck}
              tone="accent"
              hint={`${stats?.completedToday ?? 0} completed`}
            />
            <StatCard
              label="Vaccines due soon"
              value={stats?.vaccinesDueSoon ?? 0}
              icon={Syringe}
              tone="warning"
              hint="Within the next 30 days"
            />
            <StatCard
              label="Overdue vaccines"
              value={stats?.vaccinesOverdue ?? 0}
              icon={AlertTriangle}
              tone={stats?.vaccinesOverdue ? 'danger' : 'default'}
              hint="Needs follow-up"
            />
          </>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Upcoming appointments</CardTitle>
            <Link href="/appointments" className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingLoading ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : !upcoming?.length ? (
              <EmptyState
                icon={CalendarClock}
                title="Nothing scheduled"
                description="No appointments are booked for the next seven days."
              />
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.slice(0, 6).map((appointment) => (
                  <li key={appointment.id}>
                    <Link
                      href={`/appointments/${appointment.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {fullName(appointment.patient?.firstName, appointment.patient?.lastName)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {formatDateTime(appointment.scheduledAt)}
                          {appointment.chiefComplaint && ` · ${appointment.chiefComplaint}`}
                        </p>
                      </div>
                      <StatusBadge status={appointment.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent patients</CardTitle>
            <Link href="/patients" className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentLoading ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : !recent?.length ? (
              <EmptyState
                icon={UserPlus}
                title="No patients yet"
                description="Register your first patient to get started."
              />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((patient) => (
                  <li key={patient.id}>
                    <Link
                      href={`/patients/${patient.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-muted/50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                        {patient.firstName[0]}
                        {patient.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {fullName(patient.firstName, patient.lastName)}
                        </p>
                        <p className="tabular mt-0.5 text-xs text-muted-foreground">
                          {patient.mrn} · {calculateAge(patient.dateOfBirth).display}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {!statsLoading && stats && (
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <StatCard label="Pending confirmations" value={stats.pendingAppointments} icon={CalendarClock} tone="warning" />
          <StatCard label="This week" value={stats.appointmentsThisWeek} icon={CalendarCheck} />
          <StatCard label="Active prescriptions" value={stats.activePrescriptions} icon={Pill} tone="accent" />
        </div>
      )}
    </div>
  );
}
