'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LandingNavProps {
  onDemoOpen: () => void;
}

export function LandingNav({ onDemoOpen }: LandingNavProps) {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 72);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-200',
          scrolled
            ? 'border-b border-border bg-surface/95 backdrop-blur-md'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <nav
          className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between px-5 sm:px-8"
          aria-label="Navegación principal"
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
            aria-label="La Oficina Nítida — Inicio"
          >
            <div
              className={cn(
                'brand-mark brand-mark-compact',
                !scrolled && 'border-white/20 bg-white/10 text-white shadow-none',
              )}
              aria-hidden="true"
            >
              <span>1</span>
            </div>
            <span
              className={cn(
                'hidden text-sm font-semibold tracking-[-0.01em] sm:block transition-colors duration-200',
                scrolled ? 'text-foreground' : 'text-white',
              )}
            >
              La Oficina Nítida
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-6 lg:flex" aria-label="Secciones">
            <NavAnchor href="#funcionalidades" scrolled={scrolled}>
              Producto
            </NavAnchor>
            <NavAnchor href="#colombia" scrolled={scrolled}>
              Para Colombia
            </NavAnchor>
            <NavAnchor href="#roadmap" scrolled={scrolled}>
              Hoja de ruta
            </NavAnchor>
            <NavAnchor href="#faq" scrolled={scrolled}>
              FAQ
            </NavAnchor>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href="/login"
              className={cn(
                'landing-nav-link text-sm font-medium transition-colors duration-150',
                scrolled
                  ? 'text-muted-foreground hover:text-foreground'
                  : 'text-white/70 hover:text-white',
              )}
            >
              Iniciar sesión
            </Link>
            <Button
              size="sm"
              onClick={onDemoOpen}
              className={cn(
                'transition-all duration-150',
                !scrolled &&
                  'bg-white text-primary hover:bg-white/92 shadow-[0_0_0_1px_rgba(255,255,255,0.2)]',
              )}
            >
              Solicitar demo
            </Button>
          </div>

          {/* Mobile: demo + hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <Button
              size="sm"
              onClick={onDemoOpen}
              className={cn(
                'transition-all duration-150',
                !scrolled && 'bg-white text-primary hover:bg-white/92',
              )}
            >
              Demo
            </Button>
            <button
              onClick={() => setMobileOpen(true)}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-md transition-colors',
                scrolled ? 'text-foreground hover:bg-muted' : 'text-white hover:bg-white/10',
              )}
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
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-surface"
            style={{ boxShadow: '-1px 0 0 var(--border)' }}
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
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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

            <div className="mt-auto border-t border-border p-4 space-y-3">
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

function NavAnchor({
  href,
  scrolled,
  children,
}: {
  href: string;
  scrolled: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={cn(
        'text-sm font-medium transition-colors duration-150',
        scrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/70 hover:text-white',
      )}
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
      className="flex h-11 items-center rounded-md px-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
    >
      {children}
    </a>
  );
}
