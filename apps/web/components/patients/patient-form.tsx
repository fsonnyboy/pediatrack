'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea, FieldError } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { patientsApi } from '@/lib/queries';
import { ApiError } from '@/lib/api-client';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  middleName: z.string().optional(),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  bloodType: z.string().optional(),
  allergies: z.string().optional(),
  notes: z.string().optional(),
  guardianFirstName: z.string().min(1, "Guardian's first name is required"),
  guardianLastName: z.string().min(1, "Guardian's last name is required"),
  guardianRelationship: z.string().min(1, 'Relationship is required'),
  guardianPhone: z.string().min(7, 'A contact number is required'),
  guardianEmail: z.string().email('Enter a valid email').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function PatientForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { gender: 'MALE', bloodType: 'UNKNOWN', guardianRelationship: 'Mother' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      patientsApi.create({
        firstName: values.firstName,
        lastName: values.lastName,
        middleName: values.middleName || undefined,
        dateOfBirth: new Date(values.dateOfBirth).toISOString(),
        gender: values.gender,
        bloodType: values.bloodType || 'UNKNOWN',
        allergies: values.allergies
          ? values.allergies.split(',').map((a) => a.trim()).filter(Boolean)
          : [],
        notes: values.notes || undefined,
        guardians: [
          {
            firstName: values.guardianFirstName,
            lastName: values.guardianLastName,
            relationship: values.guardianRelationship,
            phone: values.guardianPhone,
            email: values.guardianEmail || undefined,
            isPrimary: true,
            isEmergencyContact: true,
          },
        ],
      }),
    onSuccess: (patient: any) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`${patient.firstName} registered as ${patient.mrn}`);
      reset();
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not register the patient.');
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Register a patient"
      description="A medical record number is assigned automatically."
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Child details
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" className="mt-1.5" {...register('firstName')} />
              <FieldError message={errors.firstName?.message} />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" className="mt-1.5" {...register('lastName')} />
              <FieldError message={errors.lastName?.message} />
            </div>
            <div>
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <Input id="dateOfBirth" type="date" className="mt-1.5" {...register('dateOfBirth')} />
              <FieldError message={errors.dateOfBirth?.message} />
            </div>
            <div>
              <Label htmlFor="gender">Sex</Label>
              <Select id="gender" className="mt-1.5" {...register('gender')}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="bloodType">Blood type</Label>
              <Select id="bloodType" className="mt-1.5" {...register('bloodType')}>
                <option value="UNKNOWN">Unknown</option>
                <option value="A_POSITIVE">A+</option>
                <option value="A_NEGATIVE">A−</option>
                <option value="B_POSITIVE">B+</option>
                <option value="B_NEGATIVE">B−</option>
                <option value="AB_POSITIVE">AB+</option>
                <option value="AB_NEGATIVE">AB−</option>
                <option value="O_POSITIVE">O+</option>
                <option value="O_NEGATIVE">O−</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="allergies">Allergies</Label>
              <Input
                id="allergies"
                placeholder="Penicillin, peanuts"
                className="mt-1.5"
                {...register('allergies')}
              />
              <p className="mt-1 text-xs text-muted-foreground">Separate each with a comma.</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Primary guardian
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="guardianFirstName">First name</Label>
              <Input id="guardianFirstName" className="mt-1.5" {...register('guardianFirstName')} />
              <FieldError message={errors.guardianFirstName?.message} />
            </div>
            <div>
              <Label htmlFor="guardianLastName">Last name</Label>
              <Input id="guardianLastName" className="mt-1.5" {...register('guardianLastName')} />
              <FieldError message={errors.guardianLastName?.message} />
            </div>
            <div>
              <Label htmlFor="guardianRelationship">Relationship</Label>
              <Select id="guardianRelationship" className="mt-1.5" {...register('guardianRelationship')}>
                <option>Mother</option>
                <option>Father</option>
                <option>Grandparent</option>
                <option>Legal Guardian</option>
                <option>Other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="guardianPhone">Contact number</Label>
              <Input id="guardianPhone" className="mt-1.5" {...register('guardianPhone')} />
              <FieldError message={errors.guardianPhone?.message} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="guardianEmail">Email (optional)</Label>
              <Input id="guardianEmail" type="email" className="mt-1.5" {...register('guardianEmail')} />
              <FieldError message={errors.guardianEmail?.message} />
            </div>
          </div>
        </section>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" className="mt-1.5" {...register('notes')} />
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Register patient
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
