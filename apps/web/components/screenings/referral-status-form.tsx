'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Label, Select, Textarea, FieldError } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { screeningsApi } from '@/lib/queries';
import { ApiError } from '@/lib/api-client';
import type { OpenReferral } from '@peditrack/types';

const schema = z.object({
  status: z.enum(['PENDING', 'SCHEDULED', 'COMPLETED', 'DECLINED', 'LOST']),
  outcomeNote: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/** Updates an existing referral's status — the other half of closing the loop. */
export function ReferralStatusForm({
  referral,
  onClose,
}: {
  referral: OpenReferral | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: referral ? { status: referral.status, outcomeNote: referral.outcomeNote ?? '' } : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!referral) throw new Error('No referral selected');
      return screeningsApi.updateReferral(referral.id, {
        status: values.status,
        outcomeNote: values.outcomeNote || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenings'] });
      toast.success('Referral updated');
      reset();
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not update the referral.');
    },
  });

  return (
    <Dialog
      open={!!referral}
      onClose={onClose}
      title="Update referral"
      description={
        referral
          ? `${referral.administration.patient.firstName} ${referral.administration.patient.lastName} — referred to ${referral.referredTo}`
          : undefined
      }
    >
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" className="mt-1.5" {...register('status')}>
            <option value="PENDING">Pending</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="DECLINED">Declined by family</option>
            <option value="LOST">Lost to follow-up</option>
          </Select>
          <FieldError message={errors.status?.message} />
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
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
