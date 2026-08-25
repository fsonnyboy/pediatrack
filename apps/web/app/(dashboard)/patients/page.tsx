'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Users } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { PatientForm } from '@/components/patients/patient-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { patientsApi } from '@/lib/queries';
import { calculateAge, formatBloodType, formatDate, fullName } from '@peditrack/utils';

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['patients', { search, gender, ageGroup, page }],
    queryFn: () => patientsApi.list({ search, gender, ageGroup, page, limit: 20 }),
  });

  const patients = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div>
      <PageHeader
        title="Patients"
        description="Every child registered at the clinic."
        action={
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Register patient
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              placeholder="Search by name or record number"
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search patients"
            />
          </div>

          <Select
            className="w-auto min-w-[130px]"
            value={gender}
            onChange={(e) => {
              setGender(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by sex"
          >
            <option value="">All sexes</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </Select>

          <Select
            className="w-auto min-w-[160px]"
            value={ageGroup}
            onChange={(e) => {
              setAgeGroup(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by age group"
          >
            <option value="">All ages</option>
            <option value="infant">Infant (under 1)</option>
            <option value="toddler">Toddler (1–3)</option>
            <option value="preschool">Preschool (3–5)</option>
            <option value="school">School age (5–12)</option>
            <option value="adolescent">Adolescent (12–18)</option>
          </Select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? 'No matching patients' : 'No patients yet'}
            description={
              search
                ? 'Try a different name or record number.'
                : 'Register your first patient to start tracking check-ups and vaccines.'
            }
            action={search ? undefined : { label: 'Register patient', onClick: () => setIsFormOpen(true) }}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Record no.</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Blood type</TableHead>
                  <TableHead>Allergies</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <Link
                        href={`/patients/${patient.id}`}
                        className="flex items-center gap-3 font-semibold text-foreground hover:text-primary"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {patient.firstName[0]}
                          {patient.lastName[0]}
                        </span>
                        {fullName(patient.firstName, patient.lastName)}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">{patient.mrn}</TableCell>
                    <TableCell className="tabular">
                      {calculateAge(patient.dateOfBirth).display}
                    </TableCell>
                    <TableCell>{formatBloodType(patient.bloodType)}</TableCell>
                    <TableCell>
                      {patient.allergies?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {patient.allergies.slice(0, 2).map((allergy) => (
                            <Badge key={allergy} variant="danger">
                              {allergy}
                            </Badge>
                          ))}
                          {patient.allergies.length > 2 && (
                            <Badge variant="neutral">+{patient.allergies.length - 2}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">None recorded</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(patient.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="tabular text-sm text-muted-foreground">
                  Page {meta.page} of {meta.totalPages} · {meta.total} patients
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!meta.hasPreviousPage}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!meta.hasNextPage}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <PatientForm open={isFormOpen} onClose={() => setIsFormOpen(false)} />
    </div>
  );
}
