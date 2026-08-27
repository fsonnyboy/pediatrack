'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { diagnosesApi } from '@/lib/queries';
import { ApiError } from '@/lib/api-client';
import type { DiagnosisCertainty, DiagnosisCodeResult, DiagnosisStatus } from '@peditrack/types';

const CERTAINTY_OPTIONS: { value: DiagnosisCertainty; label: string }[] = [
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROVISIONAL', label: 'Provisional' },
  { value: 'DIFFERENTIAL', label: 'Differential — not confirmed, being ruled in' },
];

/**
 * Debounced search-and-select over the diagnosis catalogue, plus the status
 * fields a coded problem list needs. Search must be faster than typing free
 * text or clinicians route around it — see the "Getting clinicians to use
 * it" section of the diagnosis-coding review.
 */
export function DiagnosisForm({
  open, onClose, patientId, appointmentId,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  appointmentId?: string;
}) {
  const queryClient = useQueryClient();

  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<DiagnosisCodeResult | null>(null);
  const [status, setStatus] = useState<DiagnosisStatus>('ACTIVE');
  const [certainty, setCertainty] = useState<DiagnosisCertainty>('CONFIRMED');
  const [isPrimary, setIsPrimary] = useState(true);
  const [onsetDate, setOnsetDate] = useState('');
  const [clinicalNote, setClinicalNote] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery), 250);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const reset = () => {
    setRawQuery(''); setQuery(''); setSelected(null);
    setStatus('ACTIVE'); setCertainty('CONFIRMED'); setIsPrimary(true);
    setOnsetDate(''); setClinicalNote('');
  };

  const { data: results, isFetching } = useQuery({
    queryKey: ['diagnosis-codes', query],
    queryFn: () => diagnosesApi.searchCodes({ q: query, pediatricOnly: true, limit: 15 }),
    enabled: open && !selected && query.length > 0,
  });

  const mutation = useMutation({
    mutationFn: () =>
      diagnosesApi.create({
        patientId,
        codeId: selected!.id,
        appointmentId,
        status,
        certainty,
        isPrimary,
        onsetDate: onsetDate || undefined,
        clinicalNote: clinicalNote || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId, 'diagnoses'] });
      toast.success('Diagnosis added');
      reset();
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not add the diagnosis.');
    },
  });

  const close = () => { reset(); onClose(); };

  return (
    <Dialog open={open} onClose={close} title="Add a diagnosis" className="max-w-xl">
      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="space-y-4"
      >
        {!selected ? (
          <div>
            <Label htmlFor="diagnosis-search">Search the diagnosis catalogue</Label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="diagnosis-search"
                autoFocus
                className="pl-9"
                placeholder="AOM, ear infection, asthma, H66.90…"
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
              />
            </div>

            <ul className="mt-2 max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border scrollbar-thin">
              {isFetching && (
                <li className="px-3 py-3 text-sm text-muted-foreground">Searching…</li>
              )}
              {!isFetching && query && !results?.length && (
                <li className="px-3 py-3 text-sm text-muted-foreground">
                  No match in the pediatric short-list for &ldquo;{query}&rdquo;.
                </li>
              )}
              {!query && (
                <li className="px-3 py-3 text-sm text-muted-foreground">
                  Start typing a condition, symptom, or code.
                </li>
              )}
              {results?.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-muted/60"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{r.display}</span>
                      <span className="tabular text-xs text-muted-foreground">{r.system} · {r.code}</span>
                    </span>
                    {r.usageCount > 0 && (
                      <Badge variant="outline" className="shrink-0">
                        Used {r.usageCount}×
                      </Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{selected.display}</p>
                <p className="tabular text-xs text-muted-foreground">{selected.system} · {selected.code}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Change
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" className="mt-1.5" value={status} onChange={(e) => setStatus(e.target.value as DiagnosisStatus)}>
                  <option value="ACTIVE">Active</option>
                  <option value="CHRONIC">Chronic</option>
                  <option value="RULED_OUT">Ruled out</option>
                  <option value="RESOLVED">Resolved</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="certainty">Certainty</Label>
                <Select id="certainty" className="mt-1.5" value={certainty} onChange={(e) => setCertainty(e.target.value as DiagnosisCertainty)}>
                  {CERTAINTY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="onsetDate">Onset date (optional)</Label>
                <Input id="onsetDate" type="date" className="mt-1.5" value={onsetDate} onChange={(e) => setOnsetDate(e.target.value)} />
              </div>
              <label className="mt-6 flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                />
                Primary diagnosis for this encounter
              </label>
            </div>

            <div>
              <Label htmlFor="clinicalNote">Clinical note (optional)</Label>
              <Textarea
                id="clinicalNote"
                className="mt-1.5"
                placeholder="Nuance the code alone doesn't carry"
                value={clinicalNote}
                onChange={(e) => setClinicalNote(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending} disabled={!selected}>
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Add diagnosis
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
