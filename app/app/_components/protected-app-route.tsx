"use client";

import Link from "next/link";
import { useAuth } from "@/app/_global/authentication/auth-context";

type ProtectedAppRouteProps = {
  children: React.ReactNode;
};

export function ProtectedAppRoute({ children }: ProtectedAppRouteProps) {
  const { isAuthenticated, status } = useAuth();

  if (status === "loading" || status === "signing-out") {
    return (
      <main className='flex h-[100dvh] items-center justify-center px-4 py-14 sm:px-6'>
        <section className='organic-card w-full max-w-xl rounded-4xl p-6 text-center sm:p-9'>
          <p className='mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)'>
            Authentication
          </p>
          <div
            className='mx-auto mt-6 h-14 w-14 animate-spin rounded-full border-4 border-(--border-soft) border-t-(--main)'
            aria-hidden='true'
          />
          <h1 className='display-font mt-4 text-3xl font-bold text-(--text-main)'>
            {status === "signing-out" ? "Signing out..." : "Checking your account..."}
          </h1>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className='flex h-[100dvh] items-center justify-center px-4 py-14 sm:px-6'>
        <section className='organic-card w-full max-w-xl rounded-4xl p-6 text-center sm:p-9'>
          <p className='mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)'>
            Access Denied
          </p>
          <h1 className='display-font mt-3 text-3xl font-bold text-(--text-main)'>
            You need to log in first.
          </h1>
          <p className='mt-3 text-(--text-muted)'>
            Routes under <span className='font-semibold text-(--text-main)'>/app</span>{" "}
            are only available to authenticated users.
          </p>
          <Link
            href='/login'
            className='organic-button organic-button-primary mt-6 inline-flex min-h-11 items-center px-6 py-0 text-sm'
          >
            Go to Login
          </Link>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
