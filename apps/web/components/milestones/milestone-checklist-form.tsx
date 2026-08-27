'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { milestonesApi } from '@/lib/queries';
import { ApiError } from '@/lib/api-client';
import { calculateCorrectedAge } from '@peditrack/utils';
import type { MilestoneDomain, MilestoneStatus, Patient } from '@peditrack/types';
import { MILESTONE_CHECKLIST_AGES } from '@peditrack/types';

const DOMAIN_LABEL: Record<MilestoneDomain, string> = {
  SOCIAL_EMOTIONAL: 'Social / Emotional',
  LANGUAGE_COMMUNICATION: 'Language / Communication',
  COGNITIVE: 'Cognitive',
  MOVEMENT_PHYSICAL: 'Movement / Physical',
};

const DOMAIN_ORDER: MilestoneDomain[] = [
  'SOCIAL_EMOTIONAL', 'LANGUAGE_COMMUNICATION', 'COGNITIVE', 'MOVEMENT_PHYSICAL',
];

const STATUS_OPTIONS: { value: MilestoneStatus; label: string }[] = [
  { value: 'NOT_ASSESSED', label: 'Not assessed' },
  { value: 'ACHIEVED', label: 'Achieved' },
  { value: 'EMERGING', label: 'Emerging' },
  { value: 'NOT_YET', label: 'Not yet' },
  { value: 'REGRESSED', label: 'Regressed (lost this skill)' },
];

/** Nearest checklist age to a (possibly corrected) age in months. */
function nearestChecklistAge(months: number): number {
  return MILESTONE_CHECKLIST_AGES.reduce((best, age) =>
    Math.abs(age - months) < Math.abs(best - months) ? age : best,
  );
}

export function MilestoneChecklistForm({
  open, onClose, patient,
}: {
  open: boolean;
  onClose: () => void;
  patient: Pick<Patient, 'id' | 'dateOfBirth' | 'gestationalAge'>;
}) {
  const queryClient = useQueryClient();

  const age = useMemo(
    () => calculateCorrectedAge(patient.dateOfBirth, patient.gestationalAge ?? null),
    [patient.dateOfBirth, patient.gestationalAge],
  );

  const [checklistAge, setChecklistAge] = useState(() => nearestChecklistAge(age.correctedMonths));
  const [observedAt, setObservedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [statuses, setStatuses] = useState<Record<string, MilestoneStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: definitions } = useQuery({
    queryKey: ['milestone-definitions', checklistAge],
    queryFn: () => milestonesApi.definitions(checklistAge),
    enabled: open,
  });

  // Every item defaults to NOT_ASSESSED — an item the clinician never touches
  // is recorded as explicitly unassessed, not silently dropped or passed.
  useEffect(() => {
    if (!definitions) return;
    setStatuses((prev) => {
      const next: Record<string, MilestoneStatus> = {};
      for (const d of definitions) next[d.id] = prev[d.id] ?? 'NOT_ASSESSED';
      return next;
    });
  }, [definitions]);

  const grouped = useMemo(() => {
    const groups = new Map<MilestoneDomain, typeof definitions>();
    for (const domain of DOMAIN_ORDER) groups.set(domain, []);
    for (const d of definitions ?? []) groups.get(d.domain)?.push(d);
    return groups;
  }, [definitions]);

  const mutation = useMutation({
    mutationFn: () =>
      milestonesApi.createObservations({
        patientId: patient.id,
        observedAt: new Date(observedAt).toISOString(),
        items: Object.entries(statuses).map(([definitionId, status]) => ({
          definitionId,
          status,
          note: notes[definitionId] || undefined,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id, 'milestones'] });
      toast.success('Milestone checklist recorded');
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not record the checklist.');
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record a milestone checklist"
      description={`Corrected age ${age.correctedMonths}mo · chronological ${age.chronologicalMonths}mo`}
      className="max-w-2xl"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="checklistAge">Checklist age</Label>
            <Select
              id="checklistAge"
              className="mt-1.5"
              value={checklistAge}
              onChange={(e) => setChecklistAge(Number(e.target.value))}
            >
              {MILESTONE_CHECKLIST_AGES.map((a) => (
                <option key={a} value={a}>{a < 24 ? `${a} months` : `${a / 12} years`}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="observedAt">Date observed</Label>
            <Input
              id="observedAt"
              type="date"
              className="mt-1.5"
              value={observedAt}
              onChange={(e) => setObservedAt(e.target.value)}
            />
          </div>
        </div>

        <div className="max-h-[45vh] space-y-5 overflow-y-auto pr-1">
          {DOMAIN_ORDER.map((domain) => {
            const items = grouped.get(domain);
            if (!items?.length) return null;
            return (
              <div key={domain}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {DOMAIN_LABEL[domain]}
                </h3>
                <ul className="space-y-2.5">
                  {items.map((d) => (
                    <li key={d.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm">{d.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Select
                          className="w-auto text-xs"
                          value={statuses[d.id] ?? 'NOT_ASSESSED'}
                          onChange={(e) =>
                            setStatuses((s) => ({ ...s, [d.id]: e.target.value as MilestoneStatus }))
                          }
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </Select>
                      </div>
                      {statuses[d.id] && statuses[d.id] !== 'NOT_ASSESSED' && (
                        <Textarea
                          className="mt-2 text-xs"
                          placeholder="Note (optional)"
                          value={notes[d.id] ?? ''}
                          onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {!definitions?.length && (
            <p className="text-sm text-muted-foreground">No checklist items for this age.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending} disabled={!definitions?.length}>
            Save checklist
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
