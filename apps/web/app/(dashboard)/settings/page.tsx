'use client';

import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Users } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { usersApi } from '@/lib/queries';
import { useAuthStore, permissions } from '@/lib/auth-store';
import { formatDate, fullName, titleCase } from '@peditrack/utils';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = permissions.canManageStaff(user?.role);

  const { data: staff, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title="Admin access required"
          description="Only clinic administrators can manage staff accounts and settings."
        />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" description="Manage staff accounts and clinic configuration." />

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Users className="h-4 w-4 text-primary" aria-hidden />
          <CardTitle>Staff accounts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={4} cols={4} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last signed in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff?.map((member: any) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {fullName(member.firstName, member.lastName)}
                      {member.specialty && (
                        <p className="text-xs text-muted-foreground">{member.specialty}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={member.role === 'ADMIN' ? 'default' : 'neutral'}>
                        {titleCase(member.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">
                      {member.lastLoginAt ? formatDate(member.lastLoginAt) : 'Never'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
