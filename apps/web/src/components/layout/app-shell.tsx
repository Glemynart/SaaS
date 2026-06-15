'use client';

import {
  Bell,
  BriefcaseBusiness,
  Building2,
  FileArchive,
  FileText,
  LayoutDashboard,
  LogOut,
  UserRound,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLogout, useMe } from '@/features/auth/hooks/use-auth';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard, enabled: true },
  { href: '/perfil', label: 'Perfil', icon: UserRound, enabled: true },
  { href: '#empleados', label: 'Empleados', icon: Users, enabled: false },
  { href: '#contratos', label: 'Contratos', icon: FileText, enabled: false },
  { href: '#expediente', label: 'Expediente', icon: FileArchive, enabled: false },
  { href: '#alertas', label: 'Alertas', icon: Bell, enabled: false },
  { href: '#facturacion', label: 'Facturación', icon: Receipt, enabled: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const me = useMe();
  const logout = useLogout();
  const user = me.data?.user;
  const pageTitle = pathname === '/perfil' ? 'Perfil' : 'Inicio';
  const pageDescription =
    pathname === '/perfil' ? 'Credencial y contexto de acceso' : 'Resumen de sesion y modulos';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[17.5rem] border-r border-border bg-canvas lg:flex lg:flex-col">
        <div className="flex h-[4.75rem] items-center gap-3 border-b border-border px-5">
          <div className="brand-mark brand-mark-compact" aria-hidden="true">
            <span>1</span>
          </div>
          <div translate="no">
            <p className="text-sm font-semibold tracking-[-0.01em]">La Oficina Nítida</p>
            <p className="text-xs text-muted-foreground">Mesa de operaciones</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 px-3 py-4" aria-label="Navegación principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            const className = cn(
              'group flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-[background-color,color,transform] duration-150 ease-out',
              active
                ? 'bg-surface text-foreground shadow-[inset_0_0_0_1px_var(--border)]'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              !item.enabled &&
                'cursor-not-allowed opacity-55 hover:bg-transparent hover:text-muted-foreground',
            );

            if (!item.enabled) {
              return (
                <span className={className} key={item.label} aria-disabled="true">
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </span>
              );
            }

            return (
              <Link className={className} href={item.href} key={item.label}>
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mx-3 mb-3 rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <ShieldCheck className="size-3.5 text-success" aria-hidden="true" />
            Contexto seguro
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            La empresa activa se lee desde la sesion. Los modulos futuros heredaran este contexto.
          </p>
        </div>

        <div className="border-t border-border p-4">
          {me.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-background px-3 py-2">
                <p className="truncate text-sm font-medium">
                  {user?.nombre ? `${user.nombre} ${user.apellido ?? ''}` : user?.email}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <Button
                className="w-full justify-start"
                variant="outline"
                size="sm"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                <LogOut className="size-4" aria-hidden="true" />
                Cerrar sesion
              </Button>
            </div>
          )}
        </div>
      </aside>

      <div className="lg:pl-[17.5rem]">
        <header className="sticky top-0 z-10 flex h-[4.75rem] items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="hidden size-8 place-items-center rounded-md border border-border bg-surface text-sm font-semibold sm:grid lg:hidden">
                1
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-[-0.018em] text-foreground">
                  {pageTitle}
                </p>
                <p className="truncate text-xs text-muted-foreground">{pageDescription}</p>
              </div>
            </div>
          </div>

          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
              <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[0.68rem] leading-none text-muted-foreground">Empresa activa</p>
                <p className="mt-1 truncate text-xs font-medium">
                  {user?.tenantNombre ?? 'Sesión segura'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge>{user?.rol ?? 'Cargando'}</Badge>
            <Badge className="hidden sm:inline-flex">
              <BriefcaseBusiness className="mr-1 size-3" aria-hidden="true" />
              MVP Auth
            </Badge>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
