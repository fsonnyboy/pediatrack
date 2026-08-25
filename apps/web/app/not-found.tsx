import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">404</p>
      <h1 className="text-2xl font-bold">We couldn&apos;t find that page</h1>
      <p className="max-w-sm text-muted-foreground">
        The page you&apos;re looking for may have been moved or no longer exists.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
