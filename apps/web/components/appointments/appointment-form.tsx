'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea, FieldError } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { appointmentsApi, patientsApi, usersApi } from '@/lib/queries';
import { ApiError } from '@/lib/api-client';
import { fullName } from '@peditrack/utils';

const schema = z.object({
  patientId: z.string().min(1, 'Select a patient'),
  doctorId: z.string().min(1, 'Select a doctor'),
  date: z.string().min(1, 'Pick a date'),
  time: z.string().min(1, 'Pick a time'),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  type: z.enum(['CHECKUP', 'FOLLOW_UP', 'VACCINATION', 'SICK_VISIT', 'CONSULTATION', 'EMERGENCY']),
  chiefComplaint: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AppointmentForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data: patients } = useQuery({
    queryKey: ['patients', 'picker'],
    queryFn: () => patientsApi.list({ limit: 100 }),
    enabled: open,
  });

  const { data: doctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: usersApi.doctors,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'CHECKUP', durationMinutes: 30 },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      appointmentsApi.create({
        patientId: values.patientId,
        doctorId: values.doctorId,
        scheduledAt: new Date(`${values.date}T${values.time}`).toISOString(),
        durationMinutes: values.durationMinutes,
        type: values.type,
        chiefComplaint: values.chiefComplaint || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Appointment booked');
      reset();
      onClose();
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : 'Could not book the appointment.',
      );
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title="Book an appointment">
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

        <div>
          <Label htmlFor="doctorId">Doctor</Label>
          <Select id="doctorId" className="mt-1.5" {...register('doctorId')}>
            <option value="">Select a doctor</option>
            {doctors?.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                Dr. {fullName(doctor.firstName, doctor.lastName)}
                {doctor.specialty ? ` — ${doctor.specialty}` : ''}
              </option>
            ))}
          </Select>
          <FieldError message={errors.doctorId?.message} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" className="mt-1.5" {...register('date')} />
            <FieldError message={errors.date?.message} />
          </div>
          <div>
            <Label htmlFor="time">Time</Label>
            <Input id="time" type="time" className="mt-1.5" {...register('time')} />
            <FieldError message={errors.time?.message} />
          </div>
          <div>
            <Label htmlFor="durationMinutes">Minutes</Label>
            <Input
              id="durationMinutes"
              type="number"
              min={5}
              step={5}
              className="mt-1.5"
              {...register('durationMinutes')}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="type">Visit type</Label>
          <Select id="type" className="mt-1.5" {...register('type')}>
            <option value="CHECKUP">Well-child check-up</option>
            <option value="FOLLOW_UP">Follow-up</option>
            <option value="VACCINATION">Vaccination</option>
            <option value="SICK_VISIT">Sick visit</option>
            <option value="CONSULTATION">Consultation</option>
            <option value="EMERGENCY">Emergency</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="chiefComplaint">Reason for visit (optional)</Label>
          <Textarea
            id="chiefComplaint"
            className="mt-1.5"
            placeholder="Fever and cough for two days"
            {...register('chiefComplaint')}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Book appointment
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
