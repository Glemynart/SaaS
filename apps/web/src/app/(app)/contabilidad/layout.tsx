import type { ReactNode } from 'react';
import { AccountingModuleShell } from '@/features/accounting/components/accounting-module-shell';

export default function ContabilidadLayout({ children }: { children: ReactNode }) {
  return <AccountingModuleShell>{children}</AccountingModuleShell>;
}
