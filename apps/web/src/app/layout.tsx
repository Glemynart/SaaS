import type { Metadata } from 'next';
import { ToastProvider } from '@/components/providers/toast-provider';
import { QueryProvider } from '@/lib/query-client';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Dusema Gestión',
    template: '%s | Dusema Gestión',
  },
  description: 'Plataforma de gestión laboral para operadores educativos colombianos.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        <QueryProvider>{children}</QueryProvider>
        <ToastProvider />
      </body>
    </html>
  );
}
