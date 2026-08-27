'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Activity, Lock, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { useAuthStore } from '@/lib/auth-store';
import { ApiError } from '@/lib/api-client';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const loadSession = useAuthStore((s) => s.loadSession);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Middleware only knows the cookie is present, not whether it's still
  // valid, so it can't safely redirect away from /login by itself (see
  // middleware.ts). Do that redirect here instead, only once the session
  // has been validated against the API.
  useEffect(() => {
    if (!isInitialized) void loadSession();
  }, [isInitialized, loadSession]);

  useEffect(() => {
    if (isInitialized && user) router.replace('/dashboard');
  }, [isInitialized, user, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginForm) => {
    setIsSubmitting(true);
    try {
      await login(values.email, values.password);
      toast.success('Welcome back');
      router.push('/dashboard');
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Could not reach the server. Try again.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Activity className="h-6 w-6 text-primary-foreground" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">PediTrack</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your clinic dashboard
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <div>
            <Label htmlFor="email">Email</Label>
            <div className="relative mt-1.5">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="doctor@peditrack.app"
                className="pl-9"
                {...register('email')}
              />
            </div>
            <FieldError message={errors.email?.message} />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative mt-1.5">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="pl-9"
                {...register('password')}
              />
            </div>
            <FieldError message={errors.password?.message} />
          </div>

          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Seeded accounts print their generated passwords once, when you run{' '}
          <code>npm run db:seed</code>.
        </p>
      </div>
    </div>
  );
}
