import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SideSheet({ open, onOpenChange, title, description, children }: SideSheetProps) {
  // Prevent body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white p-6 shadow-2xl transition-transform sm:w-[400px] md:w-[500px]"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between pb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              {description && <p className="text-sm text-gray-500">{description}</p>}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-full p-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2">{children}</div>
        </div>
      </div>
    </>
  );
}
