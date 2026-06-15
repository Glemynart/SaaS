import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { LoginForm } from '@/features/auth/components/login-form';

export default function LoginPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[460px] w-full max-w-md" />}>
      <LoginForm />
    </Suspense>
  );
}
