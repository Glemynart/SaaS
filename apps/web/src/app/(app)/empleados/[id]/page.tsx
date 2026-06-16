'use client';

import { use, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, FolderOpen } from 'lucide-react';
import { useEmployee } from '@/features/employees/hooks/use-employees';
import { useGenerateDocument } from '@/features/generated-documents/hooks/use-generated-documents';
import { GenerateDocumentForm } from '@/features/generated-documents/components/generate-document-form';
import type { GenerateDocumentFormValues } from '@/features/generated-documents/schemas/generated-document-schemas';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  const router = useRouter();
  const { data: employee, isLoading, error } = useEmployee(id);
  const generateMutation = useGenerateDocument();
  const [generateOpen, setGenerateOpen] = useState(false);

  const handleGenerate = useCallback(
    (formData: GenerateDocumentFormValues) => {
      generateMutation.mutate(formData, {
        onSuccess: (doc) => {
          setGenerateOpen(false);
          router.push(`/documentos/generados/${doc.id}`);
        },
      });
    },
    [generateMutation, router],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full max-w-3xl" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="py-10 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Empleado no encontrado</h2>
        <p className="mt-2 text-gray-500">
          El empleado que intentas buscar no existe o no tienes acceso.
        </p>
        <Link href="/empleados" className="mt-4 inline-block text-blue-600 hover:underline">
          Volver a la lista
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/empleados"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Empleados
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/empleados/${id}/expediente`}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-surface px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <FolderOpen className="size-4" />
            Expediente
          </Link>
          <Button onClick={() => setGenerateOpen(true)} className="gap-1.5" size="sm">
            <FileText className="size-4" />
            Generar documento
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-6 sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {employee.nombre} {employee.apellido}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {employee.tipoDocumento} {employee.cedula}
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Badge
              className={
                employee.estado === 'ACTIVO' ? 'bg-green-50 text-green-700 border-green-200' : ''
              }
            >
              {employee.estado}
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 p-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Información de Contacto</h3>
            <dl className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-gray-500">Correo Electrónico</dt>
                <dd className="font-medium text-gray-900">{employee.email || '-'}</dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-gray-500">Teléfono</dt>
                <dd className="font-medium text-gray-900">{employee.telefono || '-'}</dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-gray-500">Fecha Nacimiento</dt>
                <dd className="font-medium text-gray-900">
                  {employee.fechaNacimiento
                    ? new Date(employee.fechaNacimiento).toLocaleDateString()
                    : '-'}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Información Laboral</h3>
            <dl className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-gray-500">Cargo</dt>
                <dd className="font-medium text-gray-900">{employee.cargo}</dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-gray-500">Dependencia</dt>
                <dd className="font-medium text-gray-900">{employee.dependencia || '-'}</dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-gray-500">Tipo de Contrato</dt>
                <dd className="font-medium text-gray-900">
                  {employee.tipoContrato.replace(/_/g, ' ')}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-gray-500">Fecha de Ingreso</dt>
                <dd className="font-medium text-gray-900">
                  {new Date(employee.fechaIngreso).toLocaleDateString()}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-gray-500">Salario</dt>
                <dd className="font-medium text-gray-900">
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(
                    employee.salario,
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {employee && (
        <GenerateDocumentForm
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          employee={employee}
          onSubmit={handleGenerate}
          isSubmitting={generateMutation.isPending}
        />
      )}
    </div>
  );
}
