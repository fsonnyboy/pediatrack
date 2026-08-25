'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Activity, ArrowLeft, CheckCircle2, FileText, Thermometer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { appointmentsApi } from '@/lib/queries';
import { useAuthStore, permissions } from '@/lib/auth-store';
import { ApiError } from '@/lib/api-client';
import {
  calculateAge, classifyTemperature, formatDateTime, fullName, normalHeartRateRange, titleCase,
} from '@peditrack/utils';

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data: visit, isLoading } = useQuery<any>({
    queryKey: ['appointment', id],
    queryFn: () => appointmentsApi.get(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      appointmentsApi.setStatus(
        id,
        status,
        status === 'CANCELLED' ? 'Cancelled from the visit screen' : undefined,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Status updated');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update the status.'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!visit) return <p className="text-muted-foreground">This appointment could not be found.</p>;

  const canEdit = visit.status !== 'COMPLETED' && visit.status !== 'CANCELLED';

  return (
    <div>
      <Link
        href="/appointments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All appointments
      </Link>

      {/* Visit header */}
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-extrabold tracking-tight">{titleCase(visit.type)}</h1>
              <StatusBadge status={visit.status} />
            </div>
            <p className="tabular mt-1.5 text-sm text-muted-foreground">
              {formatDateTime(visit.scheduledAt)} · {visit.durationMinutes} minutes · Dr.{' '}
              {visit.doctor?.lastName}
            </p>
            <Link
              href={`/patients/${visit.patientId}`}
              className="mt-3 inline-flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2 transition hover:bg-muted"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {visit.patient?.firstName?.[0]}
                {visit.patient?.lastName?.[0]}
              </span>
              <span>
                <span className="block text-sm font-semibold">
                  {fullName(visit.patient?.firstName, visit.patient?.lastName)}
                </span>
                <span className="tabular block text-xs text-muted-foreground">
                  {visit.patient?.mrn} · {calculateAge(visit.patient?.dateOfBirth).display}
                </span>
              </span>
            </Link>

            {visit.patient?.allergies?.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-destructive">
                  Allergies
                </span>
                {visit.patient.allergies.map((a: string) => (
                  <Badge key={a} variant="danger">{a}</Badge>
                ))}
              </div>
            )}
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              {visit.status === 'PENDING' && (
                <Button size="sm" onClick={() => statusMutation.mutate('CONFIRMED')}>
                  Confirm
                </Button>
              )}
              {visit.status === 'CONFIRMED' && (
                <Button size="sm" onClick={() => statusMutation.mutate('IN_PROGRESS')}>
                  Start visit
                </Button>
              )}
              {visit.status === 'IN_PROGRESS' && (
                <Button size="sm" variant="accent" onClick={() => statusMutation.mutate('COMPLETED')}>
                  <CheckCircle2 className="h-4 w-4" />
                  Complete
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => statusMutation.mutate('CANCELLED')}>
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {visit.chiefComplaint && (
        <Card className="mb-5">
          <CardHeader><CardTitle>Reason for visit</CardTitle></CardHeader>
          <CardContent className="text-sm">{visit.chiefComplaint}</CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <VitalsPanel
          visit={visit}
          canEdit={canEdit && permissions.canRecordVitals(user?.role)}
        />
        <NotesPanel
          visit={visit}
          canEdit={canEdit && permissions.canViewClinicalNotes(user?.role)}
        />
      </div>
    </div>
  );
}

// ── Vitals ────────────────────────────────────────────────

function VitalsPanel({ visit, canEdit }: { visit: any; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const vitals = visit.vitalSign;

  const { register, handleSubmit } = useForm({
    defaultValues: {
      weightKg: vitals?.weightKg ?? '',
      heightCm: vitals?.heightCm ?? '',
      temperatureC: vitals?.temperatureC ?? '',
      heartRate: vitals?.heartRate ?? '',
      respiratoryRate: vitals?.respiratoryRate ?? '',
      oxygenSaturation: vitals?.oxygenSaturation ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: any) => {
      // Blank fields are omitted rather than sent as empty strings.
      const payload = Object.fromEntries(
        Object.entries(values)
          .filter(([, v]) => v !== '' && v !== null)
          .map(([k, v]) => [k, Number(v)]),
      );
      return appointmentsApi.recordVitals(visit.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', visit.id] });
      toast.success('Vitals recorded');
      setIsEditing(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save the vitals.'),
  });

  const ageMonths = visit.patient?.dateOfBirth
    ? calculateAge(visit.patient.dateOfBirth).totalMonths
    : 0;
  const hrRange = normalHeartRateRange(ageMonths);
  const temp = classifyTemperature(vitals?.temperatureC);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent" aria-hidden />
          Vital signs
        </CardTitle>
        {canEdit && !isEditing && (
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            {vitals ? 'Edit' : 'Record'}
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {isEditing ? (
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Weight (kg)" id="weightKg" step="0.1" register={register} />
              <Field label="Height (cm)" id="heightCm" step="0.1" register={register} />
              <Field label="Temperature (°C)" id="temperatureC" step="0.1" register={register} />
              <Field label="Heart rate (bpm)" id="heartRate" register={register} />
              <Field label="Respiratory rate" id="respiratoryRate" register={register} />
              <Field label="SpO₂ (%)" id="oxygenSaturation" step="0.1" register={register} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={mutation.isPending}>
                Save vitals
              </Button>
            </div>
          </form>
        ) : !vitals ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No vitals recorded for this visit yet.
          </p>
        ) : (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Metric label="Weight" value={vitals.weightKg ? `${vitals.weightKg} kg` : '—'} />
            <Metric label="Height" value={vitals.heightCm ? `${vitals.heightCm} cm` : '—'} />
            <Metric label="BMI" value={vitals.bmi ? String(vitals.bmi) : '—'} />
            <Metric
              label="Temperature"
              value={vitals.temperatureC ? `${vitals.temperatureC} °C` : '—'}
              note={vitals.temperatureC ? temp.label : undefined}
              tone={
                temp.level === 'fever' || temp.level === 'high-fever'
                  ? 'danger'
                  : temp.level === 'elevated'
                    ? 'warning'
                    : undefined
              }
            />
            <Metric
              label="Heart rate"
              value={vitals.heartRate ? `${vitals.heartRate} bpm` : '—'}
              note={vitals.heartRate ? `Normal ${hrRange.min}–${hrRange.max}` : undefined}
              tone={
                vitals.heartRate && (vitals.heartRate < hrRange.min || vitals.heartRate > hrRange.max)
                  ? 'warning'
                  : undefined
              }
            />
            <Metric
              label="SpO₂"
              value={vitals.oxygenSaturation ? `${vitals.oxygenSaturation}%` : '—'}
              tone={vitals.oxygenSaturation && vitals.oxygenSaturation < 95 ? 'danger' : undefined}
            />
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, id, step, register }: any) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" step={step ?? '1'} className="mt-1.5" {...register(id)} />
    </div>
  );
}

function Metric({
  label, value, note, tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'warning' | 'danger';
}) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="tabular mt-0.5 flex items-center gap-2 text-lg font-bold">
        {value}
        {note && (
          <Badge variant={tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'neutral'}>
            {note}
          </Badge>
        )}
      </dd>
    </div>
  );
}

// ── Clinical notes ────────────────────────────────────────

function NotesPanel({ visit, canEdit }: { visit: any; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [isWriting, setIsWriting] = useState(false);
  const { register, handleSubmit, reset } = useForm({ defaultValues: { content: '' } });

  const mutation = useMutation({
    mutationFn: (values: { content: string }) => appointmentsApi.addNote(visit.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', visit.id] });
      toast.success('Note added');
      reset();
      setIsWriting(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save the note.'),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" aria-hidden />
          Clinical notes
        </CardTitle>
        {canEdit && !isWriting && (
          <Button size="sm" variant="outline" onClick={() => setIsWriting(true)}>
            Add note
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {isWriting && (
          <form
            onSubmit={handleSubmit((v) => mutation.mutate(v))}
            className="mb-4 space-y-2 border-b border-border pb-4"
          >
            <Textarea
              placeholder="Examination findings, assessment and plan…"
              rows={4}
              {...register('content', { required: true })}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setIsWriting(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={mutation.isPending}>
                Save note
              </Button>
            </div>
          </form>
        )}

        {!visit.medicalNotes?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No notes recorded for this visit.
          </p>
        ) : (
          <ul className="space-y-3">
            {visit.medicalNotes.map((note: any) => (
              <li key={note.id} className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                <p className="tabular mt-2 text-xs text-muted-foreground">
                  {note.author?.firstName} {note.author?.lastName} · {formatDateTime(note.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
