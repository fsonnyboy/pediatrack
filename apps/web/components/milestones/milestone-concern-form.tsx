'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Label, Select, Textarea, FieldError } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { milestonesApi } from '@/lib/queries';
import { ApiError } from '@/lib/api-client';

const schema = z.object({
  source: z.enum(['CAREGIVER', 'CLINICIAN', 'TEACHER', 'OTHER']),
  domain: z.enum(['SOCIAL_EMOTIONAL', 'LANGUAGE_COMMUNICATION', 'COGNITIVE', 'MOVEMENT_PHYSICAL', '']).optional(),
  description: z.string().min(1, 'Describe the concern'),
  actionTaken: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function MilestoneConcernForm({
  open, onClose, patientId,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
}) {
  const queryClient = useQueryClient();

  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { source: 'CAREGIVER', domain: '', description: '', actionTaken: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      milestonesApi.createConcern({
        patientId,
        source: values.source,
        domain: values.domain || undefined,
        description: values.description,
        actionTaken: values.actionTaken || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId, 'milestones'] });
      toast.success('Concern recorded');
      reset();
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not record the concern.');
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title="Record a developmental concern">
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="source">Raised by</Label>
            <Select id="source" className="mt-1.5" {...register('source')}>
              <option value="CAREGIVER">Caregiver</option>
              <option value="CLINICIAN">Clinician</option>
              <option value="TEACHER">Teacher</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="domain">Domain (optional)</Label>
            <Select id="domain" className="mt-1.5" {...register('domain')}>
              <option value="">Not specific to one domain</option>
              <option value="SOCIAL_EMOTIONAL">Social / Emotional</option>
              <option value="LANGUAGE_COMMUNICATION">Language / Communication</option>
              <option value="COGNITIVE">Cognitive</option>
              <option value="MOVEMENT_PHYSICAL">Movement / Physical</option>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="description">What was raised</Label>
          <Textarea
            id="description"
            className="mt-1.5"
            placeholder="Parent noted limited word use compared to older sibling at this age"
            {...register('description')}
          />
          <FieldError message={errors.description?.message} />
        </div>

        <div>
          <Label htmlFor="actionTaken">Action taken (optional)</Label>
          <Textarea
            id="actionTaken"
            className="mt-1.5"
            placeholder="Screening moved up from the 24-month checkpoint"
            {...register('actionTaken')}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Record concern
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
