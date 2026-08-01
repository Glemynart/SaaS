'use client';

import { use, useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Award, FileText, FolderOpen, SearchX } from 'lucide-react';
import { useEmployee } from '@/features/employees/hooks/use-employees';
import {
  useGenerateDocument,
  useGeneratePdf,
} from '@/features/generated-documents/hooks/use-generated-documents';
import { GenerateDocumentForm } from '@/features/generated-documents/components/generate-document-form';
import type { GenerateDocumentFormValues } from '@/features/generated-documents/schemas/generated-document-schemas';
import { EmployeeStatusBadge } from '@/features/employees/components/employee-status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { formatNombreCompleto } from '@saas/types';
import { cn } from '@/lib/utils';
import { LaborRelationshipPanel } from '@/features/labor-relationships/components/labor-relationship-panel';

const TIPO_CONTRATO_LABEL: Record<string, string> = {
  TERMINO_FIJO: 'Término fijo',
  TERMINO_INDEFINIDO: 'Término indefinido',
  OBRA_LABOR: 'Obra o labor',
  APRENDIZAJE: 'Aprendizaje',
  PRESTACION_SERVICIOS: 'Prestación de servicios',
};

const JORNADA_LABEL: Record<string, string> = {
  COMPLETA: 'Jornada completa',
  MEDIA: 'Media jornada',
  POR_HORAS: 'Por horas',
};

const MOTIVO_RETIRO_LABEL: Record<string, string> = {
  RENUNCIA: 'Renuncia',
  TERMINACION_CONTRATO: 'Terminación de contrato',
  MUTUO_ACUERDO: 'Mutuo acuerdo',
  JUSTA_CAUSA: 'Justa causa',
  FALLECIMIENTO: 'Fallecimiento',
  OTRO: 'Otro',
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatSalario(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-foreground">{value ?? '—'}</dd>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[--radius-card] border border-border bg-surface p-5 shadow-[--shadow-card]">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <dl className="mt-2 divide-y divide-border-soft">{children}</dl>
    </section>
  );
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  const router = useRouter();
  const { data: employee, isLoading, error } = useEmployee(id);
  const generateMutation = useGenerateDocument();
  const generatePdfMutation = useGeneratePdf();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generationMode, setGenerationMode] = useState<'DOCUMENT' | 'CERTIFICATION'>('DOCUMENT');

  const handleGenerate = useCallback(
    (formData: GenerateDocumentFormValues) => {
      generateMutation.mutate(formData, {
        onSuccess: (doc) => {
          if (generationMode !== 'CERTIFICATION') {
            setGenerateOpen(false);
            router.push(`/documentos/generados/${doc.id}`);
            return;
          }

          generatePdfMutation.mutate(doc.id, {
            onSuccess: () => {
              toast.success('Certificación emitida y publicada en el expediente.');
              setGenerateOpen(false);
              router.push(`/documentos/generados/${doc.id}`);
            },
            onError: () => {
              toast.error(
                'La certificación fue creada, pero no se pudo publicar. Ábrela y reintenta la publicación.',
              );
              setGenerateOpen(false);
              router.push(`/documentos/generados/${doc.id}`);
            },
          });
        },
        onError: () => toast.error('No se pudo emitir la certificación. Inténtalo de nuevo.'),
      });
    },
    [generateMutation, generatePdfMutation, generationMode, router],
  );

  const openGeneration = useCallback((mode: 'DOCUMENT' | 'CERTIFICATION') => {
    setGenerationMode(mode);
    setGenerateOpen(true);
  }, []);

  const backLink = (
    <Link
      href="/empleados"
      className="mb-6 inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Volver a empleados
    </Link>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        {backLink}
        <div className="mb-8 space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full sm:col-span-2" />
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="mx-auto max-w-3xl">
        {backLink}
        <EmptyState
          icon={SearchX}
          title="Empleado no encontrado."
          description="El empleado que buscas no existe o no tienes acceso."
          action={
            <Link
              href="/empleados"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Volver a empleados
            </Link>
          }
        />
      </div>
    );
  }

  const hasRetiro = Boolean(employee.fechaRetiro || employee.motivoRetiro);

  return (
    <div className="mx-auto max-w-3xl">
      {backLink}

      <PageHeader
        title={formatNombreCompleto(employee)}
        description={`${employee.tipoDocumento} ${employee.cedula}`}
        width="detail"
        className="max-w-none"
        actions={
          <>
            <EmployeeStatusBadge estado={employee.estado} />
            <Link
              href={`/empleados/${id}/expediente`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              <FolderOpen className="size-4" aria-hidden="true" />
              Expediente
            </Link>
            <Button onClick={() => openGeneration('DOCUMENT')} size="sm" variant="outline">
              <FileText className="size-4" aria-hidden="true" />
              Generar documento
            </Button>
            <Button onClick={() => openGeneration('CERTIFICATION')} size="sm">
              <Award className="size-4" aria-hidden="true" />
              Emitir certificación
            </Button>
          </>
        }
      >
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <SectionCard title="Contacto">
            <Field label="Correo electrónico" value={employee.email} />
            <Field label="Teléfono" value={employee.telefono} />
          </SectionCard>

          <SectionCard title="Información personal">
            <Field
              label="Documento"
              value={
                <>
                  {employee.tipoDocumento} <span className="font-mono">{employee.cedula}</span>
                </>
              }
            />
            <Field label="Fecha de nacimiento" value={formatDate(employee.fechaNacimiento)} />
          </SectionCard>

          <section className="rounded-[--radius-card] border border-border bg-surface p-5 shadow-[--shadow-card] sm:col-span-2">
            <h2 className="text-base font-semibold text-foreground">Información laboral</h2>
            <dl className="mt-2 gap-x-10 divide-y divide-border-soft sm:grid sm:grid-cols-2 sm:divide-y-0">
              <div className="divide-y divide-border-soft">
                <Field label="Cargo" value={employee.cargo} />
                <Field label="Dependencia" value={employee.dependencia} />
                <Field label="Sede" value={employee.sedeRef?.nombre ?? null} />
                <Field
                  label="Tipo de contrato"
                  value={TIPO_CONTRATO_LABEL[employee.tipoContrato] ?? employee.tipoContrato}
                />
              </div>
              <div className="divide-y divide-border-soft">
                <Field
                  label="Jornada laboral"
                  value={
                    employee.jornadaLaboral
                      ? (JORNADA_LABEL[employee.jornadaLaboral] ?? employee.jornadaLaboral)
                      : null
                  }
                />
                <Field label="Fecha de ingreso" value={formatDate(employee.fechaIngreso)} />
                <Field
                  label="Salario"
                  value={<span className="font-mono">{formatSalario(employee.salario)}</span>}
                />
                <Field label="Salario integral" value={employee.salarioIntegral ? 'Sí' : 'No'} />
              </div>
            </dl>
          </section>

          {hasRetiro && (
            <SectionCard title="Retiro">
              <Field label="Fecha de retiro" value={formatDate(employee.fechaRetiro)} />
              <Field
                label="Motivo"
                value={
                  employee.motivoRetiro
                    ? (MOTIVO_RETIRO_LABEL[employee.motivoRetiro] ?? employee.motivoRetiro)
                    : null
                }
              />
            </SectionCard>
          )}
        </div>
      </PageHeader>

      <LaborRelationshipPanel employeeId={id} />

      {employee && (
        <GenerateDocumentForm
          key={generationMode}
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          employee={employee}
          onSubmit={handleGenerate}
          isSubmitting={generateMutation.isPending || generatePdfMutation.isPending}
          templateType={generationMode === 'CERTIFICATION' ? 'CERTIFICATION' : undefined}
        />
      )}
    </div>
  );
}
