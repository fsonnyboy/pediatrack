'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardList, Star } from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Select } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { diagnosesApi } from '@/lib/queries';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@peditrack/utils';
import type { DiagnosisStatus, PatientDiagnosis } from '@peditrack/types';

const STATUS_BADGE: Record<DiagnosisStatus, { variant: BadgeProps['variant']; label: string }> = {
  ACTIVE: { variant: 'warning', label: 'Active' },
  CHRONIC: { variant: 'accent', label: 'Chronic' },
  RULED_OUT: { variant: 'neutral', label: 'Ruled out' },
  RESOLVED: { variant: 'success', label: 'Resolved' },
};

const CERTAINTY_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  PROVISIONAL: 'Provisional',
  DIFFERENTIAL: 'Differential',
};

/** The coded problem list — patient-level, so a status survives the appointment it was made in. */
export function ProblemList({ patientId, diagnoses }: { patientId: string; diagnoses: PatientDiagnosis[] }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DiagnosisStatus }) =>
      diagnosesApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId, 'diagnoses'] });
      toast.success('Diagnosis updated');
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not update the diagnosis.');
    },
  });

  if (!diagnoses.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No coded diagnoses yet"
        description="Add a diagnosis to start this patient's structured problem list."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {diagnoses.map((d) => (
        <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              {d.isPrimary && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Primary diagnosis" />}
              {d.code?.display ?? 'Unknown diagnosis'}
            </p>
            <p className="tabular mt-0.5 text-xs text-muted-foreground">
              {d.code?.system} · {d.code?.code} · {CERTAINTY_LABEL[d.certainty]} · Diagnosed {formatDate(d.diagnosedAt)}
              {d.diagnosedBy && ` by ${d.diagnosedBy.firstName} ${d.diagnosedBy.lastName}`}
            </p>
            {d.onsetDate && (
              <p className="tabular mt-0.5 text-xs text-muted-foreground">Onset {formatDate(d.onsetDate)}</p>
            )}
            {d.clinicalNote && <p className="mt-1.5 text-sm text-muted-foreground">{d.clinicalNote}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={STATUS_BADGE[d.status].variant}>{STATUS_BADGE[d.status].label}</Badge>
            <Select
              className="h-8 w-auto text-xs"
              value={d.status}
              disabled={mutation.isPending}
              onChange={(e) => mutation.mutate({ id: d.id, status: e.target.value as DiagnosisStatus })}
              aria-label={`Change status for ${d.code?.display ?? 'diagnosis'}`}
            >
              <option value="ACTIVE">Active</option>
              <option value="CHRONIC">Chronic</option>
              <option value="RULED_OUT">Ruled out</option>
              <option value="RESOLVED">Resolved</option>
            </Select>
          </div>
        </li>
      ))}
    </ul>
  );
}
