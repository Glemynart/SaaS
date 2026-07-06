'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LandingNavProps {
  onDemoOpen: () => void;
}

export function LandingNav({ onDemoOpen }: LandingNavProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  function handleDemoClick() {
    setMobileOpen(false);
    onDemoOpen();
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-(--z-sticky) border-b border-border bg-surface/95 backdrop-blur-md">
        <nav
          className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between px-5 sm:px-8"
          aria-label="Navegación principal"
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="La Oficina Nítida — Inicio"
          >
            <div className="brand-mark brand-mark-compact" aria-hidden="true">
              <span>1</span>
            </div>
            <span className="hidden text-sm font-semibold tracking-[-0.01em] text-foreground sm:block">
              La Oficina Nítida
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-6 lg:flex" aria-label="Secciones">
            <NavAnchor href="#funcionalidades">Producto</NavAnchor>
            <NavAnchor href="#colombia">Para Colombia</NavAnchor>
            <NavAnchor href="#roadmap">Hoja de ruta</NavAnchor>
            <NavAnchor href="#faq">FAQ</NavAnchor>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              Iniciar sesión
            </Link>
            <Button size="sm" onClick={onDemoOpen}>
              Solicitar demo
            </Button>
          </div>

          {/* Mobile: demo + hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <Button size="sm" onClick={onDemoOpen}>
              Demo
            </Button>
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
              aria-label="Abrir menú"
              aria-expanded={mobileOpen}
            >
              <Menu className="size-5" />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-(--z-overlay) bg-(--overlay) backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="fixed inset-y-0 right-0 z-(--z-overlay) flex w-full max-w-sm flex-col border-l border-border bg-surface"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="brand-mark brand-mark-compact" aria-hidden="true">
                  <span>1</span>
                </div>
                <span className="text-sm font-semibold text-foreground">La Oficina Nítida</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cerrar menú"
              >
                <X className="size-4" />
              </button>
            </div>

            <nav className="flex flex-col gap-1 p-4">
              <MobileNavLink href="#funcionalidades" onClick={() => setMobileOpen(false)}>
                Producto
              </MobileNavLink>
              <MobileNavLink href="#colombia" onClick={() => setMobileOpen(false)}>
                Para Colombia
              </MobileNavLink>
              <MobileNavLink href="#como-funciona" onClick={() => setMobileOpen(false)}>
                Cómo funciona
              </MobileNavLink>
              <MobileNavLink href="#comparacion" onClick={() => setMobileOpen(false)}>
                Comparación
              </MobileNavLink>
              <MobileNavLink href="#roadmap" onClick={() => setMobileOpen(false)}>
                Hoja de ruta
              </MobileNavLink>
              <MobileNavLink href="#faq" onClick={() => setMobileOpen(false)}>
                Preguntas frecuentes
              </MobileNavLink>
            </nav>

            <div className="mt-auto space-y-3 border-t border-border p-4">
              <Button className="w-full" onClick={handleDemoClick}>
                Solicitar demo gratuita
              </Button>
              <Link
                href="/login"
                className="flex h-10 items-center justify-center rounded-md border border-border bg-control text-sm font-medium text-foreground transition-colors hover:bg-muted"
                onClick={() => setMobileOpen(false)}
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function NavAnchor({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
    >
      {children}
    </a>
  );
}

function MobileNavLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="flex h-11 items-center rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
    >
      {children}
    </a>
  );
}
