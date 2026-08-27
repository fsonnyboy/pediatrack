'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input, Label, Textarea, FieldError } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { screeningsApi } from '@/lib/queries';
import { ApiError } from '@/lib/api-client';
import type { UnaddressedScreening } from '@peditrack/types';

const schema = z.object({
  referredTo: z.string().min(1, 'Say where the referral is going'),
  referredAt: z.string().min(1, 'Pick a date'),
  outcomeNote: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/** Opens a referral for a screening that came back REFER with nothing on file yet. */
export function ReferralForm({
  screening,
  onClose,
}: {
  screening: UnaddressedScreening | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!screening) throw new Error('No screening selected');
      return screeningsApi.createReferral(screening.id, {
        referredTo: values.referredTo,
        referredAt: new Date(values.referredAt).toISOString(),
        outcomeNote: values.outcomeNote || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenings'] });
      toast.success('Referral opened');
      reset();
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not open the referral.');
    },
  });

  return (
    <Dialog
      open={!!screening}
      onClose={onClose}
      title="Open a referral"
      description={
        screening
          ? `${screening.patient.firstName} ${screening.patient.lastName} — ${screening.instrument.name}, ${screening.scheduledAgeMonths}mo checkpoint`
          : undefined
      }
    >
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <div>
          <Label htmlFor="referredTo">Referred to</Label>
          <Input
            id="referredTo"
            className="mt-1.5"
            placeholder="Early Intervention, audiology, developmental peds..."
            {...register('referredTo')}
          />
          <FieldError message={errors.referredTo?.message} />
        </div>

        <div>
          <Label htmlFor="referredAt">Date referred</Label>
          <Input id="referredAt" type="date" className="mt-1.5" {...register('referredAt')} />
          <FieldError message={errors.referredAt?.message} />
        </div>

        <div>
          <Label htmlFor="outcomeNote">Note (optional)</Label>
          <Textarea id="outcomeNote" className="mt-1.5" {...register('outcomeNote')} />
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Open referral
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
