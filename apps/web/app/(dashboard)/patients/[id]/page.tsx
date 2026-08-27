'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowLeft, Baby, Calendar, ClipboardCheck, ClipboardList, Phone, Pill, Plus,
  Syringe, TrendingUp, User,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, StatusBadge, type BadgeProps } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { GrowthChart } from '@/components/growth/GrowthChart';
import { useGrowthChart } from '@/hooks/useGrowthChart';
import { MilestoneChecklistForm } from '@/components/milestones/milestone-checklist-form';
import { MilestoneConcernForm } from '@/components/milestones/milestone-concern-form';
import { DiagnosisForm } from '@/components/diagnoses/diagnosis-form';
import { ProblemList } from '@/components/diagnoses/problem-list';
import { cn } from '@/lib/utils';
import { patientsApi } from '@/lib/queries';
import {
  calculateAge, formatBloodType, formatDate, formatDateTime, formatPhone, fullName,
} from '@peditrack/utils';
import type { ScreeningOutcome, MilestoneDomain, MilestoneStatus } from '@peditrack/types';

const TABS = [
  { id: 'overview',      label: 'Overview',      icon: User },
  { id: 'visits',        label: 'Visits',        icon: Calendar },
  { id: 'diagnoses',     label: 'Diagnoses',     icon: ClipboardList },
  { id: 'vaccinations',  label: 'Vaccinations',  icon: Syringe },
  { id: 'screening',     label: 'Screening',     icon: ClipboardCheck },
  { id: 'milestones',    label: 'Milestones',    icon: Baby },
  { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { id: 'growth',        label: 'Growth',        icon: TrendingUp },
] as const;

const OUTCOME_BADGE: Record<ScreeningOutcome, { variant: BadgeProps['variant']; label: string }> = {
  PASS: { variant: 'success', label: 'Pass' },
  MONITOR: { variant: 'warning', label: 'Monitor' },
  REFER: { variant: 'danger', label: 'Refer' },
  INCOMPLETE: { variant: 'neutral', label: 'Incomplete' },
};

const DOMAIN_LABEL: Record<MilestoneDomain, string> = {
  SOCIAL_EMOTIONAL: 'Social / Emotional',
  LANGUAGE_COMMUNICATION: 'Language / Communication',
  COGNITIVE: 'Cognitive',
  MOVEMENT_PHYSICAL: 'Movement / Physical',
};

const MILESTONE_STATUS_BADGE: Record<MilestoneStatus, { variant: BadgeProps['variant']; label: string }> = {
  ACHIEVED: { variant: 'success', label: 'Achieved' },
  EMERGING: { variant: 'accent', label: 'Emerging' },
  NOT_YET: { variant: 'warning', label: 'Not yet' },
  NOT_ASSESSED: { variant: 'neutral', label: 'Not assessed' },
  REGRESSED: { variant: 'danger', label: 'Regressed' },
};

type TabId = (typeof TABS)[number]['id'];

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<TabId>('overview');
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [concernOpen, setConcernOpen] = useState(false);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsApi.get(id),
  });

  const { data: visits } = useQuery({
    queryKey: ['patient', id, 'appointments'],
    queryFn: () => patientsApi.appointments(id),
    enabled: tab === 'visits',
  });

  const { data: vaccinations } = useQuery({
    queryKey: ['patient', id, 'vaccinations'],
    queryFn: () => patientsApi.vaccinations(id),
    enabled: tab === 'vaccinations',
  });

  const { data: prescriptions } = useQuery({
    queryKey: ['patient', id, 'prescriptions'],
    queryFn: () => patientsApi.prescriptions(id),
    enabled: tab === 'prescriptions',
  });

  const { data: screenings } = useQuery({
    queryKey: ['patient', id, 'screenings'],
    queryFn: () => patientsApi.screenings(id),
    enabled: tab === 'screening',
  });

  const { data: milestones } = useQuery({
    queryKey: ['patient', id, 'milestones'],
    queryFn: () => patientsApi.milestones(id),
    enabled: tab === 'milestones',
  });

  const { data: diagnoses } = useQuery({
    queryKey: ['patient', id, 'diagnoses'],
    queryFn: () => patientsApi.diagnoses(id),
    enabled: tab === 'diagnoses',
  });

  const {
    data: growth, isLoading: growthLoading, error: growthError, refetch: refetchGrowth,
  } = useGrowthChart(tab === 'growth' ? id : '');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!patient) {
    return (
      <EmptyState
        icon={User}
        title="Patient not found"
        description="This record may have been archived."
      />
    );
  }

  const age = calculateAge(patient.dateOfBirth);
  const guardian = patient.guardians?.[0];

  return (
    <div>
      <Link
        href="/patients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All patients
      </Link>

      {/* Patient header */}
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-start gap-5 p-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-extrabold text-primary">
            {patient.firstName[0]}
            {patient.lastName[0]}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold tracking-tight">
              {fullName(patient.firstName, patient.lastName, patient.middleName)}
            </h1>
            <div className="tabular mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{patient.mrn}</span>
              <span>{age.display}</span>
              <span>{formatDate(patient.dateOfBirth)}</span>
              <span>{patient.gender === 'MALE' ? 'Male' : patient.gender === 'FEMALE' ? 'Female' : 'Other'}</span>
              <span>Blood type {formatBloodType(patient.bloodType)}</span>
            </div>

            {patient.allergies?.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
                <span className="text-xs font-bold uppercase tracking-wider text-destructive">
                  Allergies
                </span>
                {patient.allergies.map((allergy) => (
                  <Badge key={allergy} variant="danger">
                    {allergy}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {guardian && (
            <div className="rounded-lg border border-border bg-muted/40 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Primary guardian
              </p>
              <p className="mt-1 text-sm font-semibold">
                {fullName(guardian.firstName, guardian.lastName)}
              </p>
              <p className="text-xs text-muted-foreground">{guardian.relationship}</p>
              <p className="tabular mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" aria-hidden />
                {formatPhone(guardian.phone)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border scrollbar-thin">
        {TABS.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={cn(
              'flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              tab === tabId
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            aria-current={tab === tabId ? 'true' : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Birth details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <Row label="Birth weight" value={patient.birthWeightKg ? `${patient.birthWeightKg} kg` : 'Not recorded'} />
              <Row label="Birth length" value={patient.birthHeightCm ? `${patient.birthHeightCm} cm` : 'Not recorded'} />
              <Row label="Gestational age" value={patient.gestationalAge ? `${patient.gestationalAge} weeks` : 'Not recorded'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Medical background</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <Row
                label="Chronic conditions"
                value={patient.chronicConditions?.length ? patient.chronicConditions.join(', ') : 'None recorded'}
              />
              <Row label="Notes" value={patient.notes || 'None'} />
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Guardians</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {patient.guardians?.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {fullName(g.firstName, g.lastName)}
                        {g.isPrimary && (
                          <Badge variant="accent" className="ml-2">
                            Primary
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{g.relationship}</p>
                    </div>
                    <div className="tabular text-right text-sm">
                      <p>{formatPhone(g.phone)}</p>
                      {g.email && <p className="text-xs text-muted-foreground">{g.email}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Visits */}
      {tab === 'visits' && (
        <Card>
          <CardContent className="p-0">
            {!visits?.length ? (
              <EmptyState icon={Calendar} title="No visits yet" description="Book an appointment to start the visit history." />
            ) : (
              <ul className="divide-y divide-border">
                {visits.map((visit) => (
                  <li key={visit.id}>
                    <Link
                      href={`/appointments/${visit.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {visit.type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDateTime(visit.scheduledAt)}
                          {visit.chiefComplaint && ` · ${visit.chiefComplaint}`}
                        </p>
                      </div>
                      <StatusBadge status={visit.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Diagnoses — the coded problem list. Replaces reading free-text
          diagnosis strings off individual visits: this survives the
          appointment it was made in and can actually be counted. */}
      {tab === 'diagnoses' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Coded conditions this patient has been diagnosed with, tracked over time.
            </p>
            <Button size="sm" onClick={() => setDiagnosisOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add diagnosis
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <ProblemList patientId={id} diagnoses={diagnoses ?? []} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Vaccinations */}
      {tab === 'vaccinations' && (
        <Card>
          <CardContent className="p-0">
            {!vaccinations?.length ? (
              <EmptyState icon={Syringe} title="No vaccines recorded" description="Immunizations will appear here once administered." />
            ) : (
              <ul className="divide-y divide-border">
                {vaccinations.map((record) => (
                  <li key={record.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                    <div>
                      <p className="text-sm font-semibold">
                        {record.vaccine?.name}{' '}
                        <span className="tabular text-muted-foreground">· Dose {record.doseNumber}</span>
                      </p>
                      <p className="tabular mt-0.5 text-xs text-muted-foreground">
                        Given {formatDate(record.administeredAt)}
                        {record.batchNumber && ` · Batch ${record.batchNumber}`}
                        {record.site && ` · ${record.site}`}
                      </p>
                    </div>
                    {record.nextDueDate && (
                      <Badge variant="warning">Next dose {formatDate(record.nextDueDate)}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Screening */}
      {tab === 'screening' && (
        <Card>
          <CardContent className="p-0">
            {!screenings?.length ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No screenings recorded"
                description="Developmental screening results will appear here once administered."
              />
            ) : (
              <ul className="divide-y divide-border">
                {screenings.map((s) => (
                  <li key={s.id} className="px-5 py-4">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {s.instrument?.name}{' '}
                        <span className="tabular text-muted-foreground">
                          · {s.scheduledAgeMonths}mo checkpoint
                        </span>
                      </p>
                      <Badge variant={OUTCOME_BADGE[s.outcome].variant}>
                        {OUTCOME_BADGE[s.outcome].label}
                      </Badge>
                    </div>
                    <p className="tabular text-xs text-muted-foreground">
                      Administered {formatDate(s.administeredAt)}
                      {s.totalScore != null && ` · Score ${s.totalScore}`}
                    </p>
                    {s.concernNote && (
                      <p className="mt-1.5 text-sm text-muted-foreground">{s.concernNote}</p>
                    )}
                    {s.outcome === 'REFER' && (
                      <div className="mt-2">
                        {s.referral ? (
                          <Badge variant="outline">
                            Referred to {s.referral.referredTo} · {s.referral.status.toLowerCase()}
                          </Badge>
                        ) : (
                          <Link href="/screenings/referrals" className="inline-block">
                            <Badge variant="danger">No referral on file — open one</Badge>
                          </Link>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Milestones — developmental surveillance, distinct from the formal
          screening checkpoints above: this is the continuous record built
          from every well-child visit rather than four discrete events. */}
      {tab === 'milestones' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Milestone checklist observations and developmental concerns raised over time.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setConcernOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Log concern
              </Button>
              <Button size="sm" onClick={() => setChecklistOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Record checklist
              </Button>
            </div>
          </div>

          {milestones?.concerns && milestones.concerns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Developmental concerns</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {milestones.concerns.map((c) => (
                    <li key={c.id} className="px-5 py-3.5">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {c.source.charAt(0) + c.source.slice(1).toLowerCase()}
                          {c.domain && (
                            <span className="tabular text-muted-foreground"> · {DOMAIN_LABEL[c.domain]}</span>
                          )}
                        </p>
                        <Badge variant={c.resolvedAt ? 'success' : 'warning'}>
                          {c.resolvedAt ? 'Resolved' : 'Open'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{c.description}</p>
                      {c.actionTaken && (
                        <p className="mt-1 text-xs text-muted-foreground">Action: {c.actionTaken}</p>
                      )}
                      <p className="tabular mt-1 text-xs text-muted-foreground">
                        Raised {formatDate(c.raisedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Milestone trajectory</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!milestones?.observations?.length ? (
                <EmptyState
                  icon={Baby}
                  title="No milestones recorded"
                  description="Record a checklist pass to start building this patient's developmental trajectory."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {milestones.observations.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{o.definition?.description}</p>
                        <p className="tabular mt-0.5 text-xs text-muted-foreground">
                          {o.definition && DOMAIN_LABEL[o.definition.domain]} · {formatDate(o.observedAt)} ·{' '}
                          {o.ageBasisUsed === 'CORRECTED'
                            ? `${o.correctedAgeMonths}mo corrected (${o.chronologicalAgeMonths}mo chronological)`
                            : `${o.chronologicalAgeMonths}mo`}
                        </p>
                        {o.note && <p className="mt-1 text-sm text-muted-foreground">{o.note}</p>}
                      </div>
                      <Badge variant={MILESTONE_STATUS_BADGE[o.status].variant}>
                        {MILESTONE_STATUS_BADGE[o.status].label}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {patient && (
        <>
          <MilestoneChecklistForm
            open={checklistOpen}
            onClose={() => setChecklistOpen(false)}
            patient={patient}
          />
          <MilestoneConcernForm
            open={concernOpen}
            onClose={() => setConcernOpen(false)}
            patientId={patient.id}
          />
          <DiagnosisForm
            open={diagnosisOpen}
            onClose={() => setDiagnosisOpen(false)}
            patientId={patient.id}
          />
        </>
      )}

      {/* Prescriptions */}
      {tab === 'prescriptions' && (
        <Card>
          <CardContent className="p-0">
            {!prescriptions?.length ? (
              <EmptyState icon={Pill} title="No prescriptions" description="Medicines prescribed at visits will be listed here." />
            ) : (
              <ul className="divide-y divide-border">
                {prescriptions.map((prescription) => (
                  <li key={prescription.id} className="px-5 py-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="tabular text-sm font-semibold">
                        Issued {formatDate(prescription.issuedAt)}
                      </p>
                      <StatusBadge status={prescription.status} />
                    </div>
                    <ul className="space-y-1.5">
                      {prescription.items?.map((item) => (
                        <li key={item.id} className="text-sm">
                          <span className="font-medium">{item.medicineName}</span>{' '}
                          <span className="text-muted-foreground">
                            {item.dosage} · {item.frequency} · {item.durationDays} days
                          </span>
                          {item.instructions && (
                            <p className="text-xs text-muted-foreground">{item.instructions}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Growth */}
      {tab === 'growth' && (
        <>
          {growthLoading && (
            <div className="space-y-4">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-96" />
            </div>
          )}

          {!growthLoading && growthError && (
            <EmptyState
              icon={TrendingUp}
              title="Could not load growth data"
              description={growthError}
              action={{ label: 'Retry', onClick: refetchGrowth }}
            />
          )}

          {!growthLoading && !growthError && growth && (
            <GrowthChart
              data={growth}
              patientName={fullName(patient.firstName, patient.lastName, patient.middleName)}
              chartHeight={400}
            />
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
