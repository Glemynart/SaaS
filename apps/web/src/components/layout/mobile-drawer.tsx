'use client';

import * as React from 'react';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Drawer móvil (APP-SHELL.md §6.4, corrige H5): mismo contenido que el
 * sidebar expandido, contrato de diálogo completo (focus trap, Esc, retorno
 * de foco — reutiliza los hooks de SideSheet/ConfirmDialog). Se cierra al
 * navegar (Sidebar.onNavigate) y al tocar el backdrop.
 */
export function MobileDrawer({ open, onOpenChange }: MobileDrawerProps) {
  const containerRef = useFocusTrap(open);
  useBodyScrollLock(open);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[--z-overlay] bg-[--overlay] transition-opacity lg:hidden"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navegación principal"
        className={cn(
          'fixed inset-y-0 left-0 z-[--z-overlay] w-[17.5rem] border-r border-border shadow-[--shadow-overlay] transition-transform duration-[--duration-base] ease-[--ease-out-ui] lg:hidden',
          visible ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar collapsed={false} onNavigate={() => onOpenChange(false)} />
      </div>
    </>
  );
}
