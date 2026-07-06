'use client';

import * as React from 'react';

/** Locks body scroll while `active` (dialog contract §6.5). Shared by SideSheet and ConfirmDialog. */
export function useBodyScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [active]);
}
