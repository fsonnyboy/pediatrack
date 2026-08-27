'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea, FieldError } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { screeningsApi, patientsApi } from '@/lib/queries';
import { ApiError } from '@/lib/api-client';
import { fullName } from '@peditrack/utils';
import type { ScreeningType } from '@peditrack/types';

/** Which instrument type(s) fulfil each AAP checkpoint — 18mo needs both. */
const CHECKPOINT_TYPES: Record<number, ScreeningType[]> = {
  9: ['GENERAL'],
  18: ['GENERAL', 'AUTISM'],
  24: ['AUTISM'],
  30: ['GENERAL'],
};

const schema = z.object({
  patientId: z.string().min(1, 'Select a patient'),
  instrumentId: z.string().min(1, 'Select an instrument'),
  scheduledAgeMonths: z.coerce.number().int().refine((v) => [9, 18, 24, 30].includes(v), {
    message: 'Must be a scheduled checkpoint',
  }),
  administeredAt: z.string().min(1, 'Pick a date'),
  totalScore: z.coerce.number().int().min(0).optional().or(z.literal('').transform(() => undefined)),
  outcome: z.enum(['PASS', 'MONITOR', 'REFER', 'INCOMPLETE']),
  concernNote: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function ScreeningForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data: patients } = useQuery({
    queryKey: ['patients', 'picker'],
    queryFn: () => patientsApi.list({ limit: 100 }),
    enabled: open,
  });

  const { data: instruments } = useQuery({
    queryKey: ['screening-instruments'],
    queryFn: screeningsApi.instruments,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { scheduledAgeMonths: 9, outcome: 'PASS' },
  });

  const scheduledAgeMonths = watch('scheduledAgeMonths');
  const eligibleInstruments = useMemo(() => {
    const types = CHECKPOINT_TYPES[Number(scheduledAgeMonths)] ?? [];
    return instruments?.filter((i) => types.includes(i.type)) ?? [];
  }, [instruments, scheduledAgeMonths]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      screeningsApi.create({
        patientId: values.patientId,
        instrumentId: values.instrumentId,
        scheduledAgeMonths: values.scheduledAgeMonths,
        administeredAt: new Date(values.administeredAt).toISOString(),
        totalScore: values.totalScore,
        outcome: values.outcome,
        concernNote: values.concernNote || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Screening recorded');
      reset();
      onClose();
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : 'Could not record the screening.',
      );
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title="Record a developmental screening">
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <div>
          <Label htmlFor="patientId">Patient</Label>
          <Select id="patientId" className="mt-1.5" {...register('patientId')}>
            <option value="">Select a patient</option>
            {patients?.data.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {fullName(patient.firstName, patient.lastName)} — {patient.mrn}
              </option>
            ))}
          </Select>
          <FieldError message={errors.patientId?.message} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="scheduledAgeMonths">Checkpoint</Label>
            <Select id="scheduledAgeMonths" className="mt-1.5" {...register('scheduledAgeMonths')}>
              <option value={9}>9 months — general</option>
              <option value={18}>18 months — general + autism</option>
              <option value={24}>24 months — autism</option>
              <option value={30}>30 months — general</option>
            </Select>
            <FieldError message={errors.scheduledAgeMonths?.message} />
          </div>

          <div>
            <Label htmlFor="instrumentId">Instrument</Label>
            <Select id="instrumentId" className="mt-1.5" {...register('instrumentId')}>
              <option value="">Select an instrument</option>
              {eligibleInstruments.map((instrument) => (
                <option key={instrument.id} value={instrument.id}>
                  {instrument.name}
                </option>
              ))}
            </Select>
            <FieldError message={errors.instrumentId?.message} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="administeredAt">Date administered</Label>
            <Input id="administeredAt" type="date" className="mt-1.5" {...register('administeredAt')} />
            <FieldError message={errors.administeredAt?.message} />
          </div>
          <div>
            <Label htmlFor="totalScore">Total score (optional)</Label>
            <Input id="totalScore" type="number" min={0} className="mt-1.5" {...register('totalScore')} />
          </div>
        </div>

        <div>
          <Label htmlFor="outcome">Outcome</Label>
          <Select id="outcome" className="mt-1.5" {...register('outcome')}>
            <option value="PASS">Pass</option>
            <option value="MONITOR">Monitor</option>
            <option value="REFER">Refer</option>
            <option value="INCOMPLETE">Incomplete</option>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            This is a screening result, not a diagnosis — it records what the instrument
            indicates, nothing more.
          </p>
        </div>

        <div>
          <Label htmlFor="concernNote">Concern note (optional)</Label>
          <Textarea
            id="concernNote"
            className="mt-1.5"
            placeholder="Parent noted limited word use compared to older sibling at this age"
            {...register('concernNote')}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Record screening
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
