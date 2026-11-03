'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Loader2, Upload } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SideSheet } from '@/components/ui/side-sheet';
import { toast } from '@/components/ui/toast';
import { useImportPilaWorkAssignments } from '@/features/employees/hooks/use-employees';
import {
  employeesApi,
  ImportError,
  type ImportPilaWorkAssignmentsResult,
} from '@/features/employees/services/employees-api';
import { getUserFacingError } from '@/lib/error-message';

export function PilaWorkAssignmentImportSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<
    | (Partial<ImportPilaWorkAssignmentsResult> & {
        errors?: { fila: number; campo: string; mensaje: string }[];
      })
    | null
  >(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useImportPilaWorkAssignments();

  const handleDownload = async () => {
    try {
      await employeesApi.downloadPilaWorkAssignmentsTemplate();
    } catch (error) {
      toast.error(
        getUserFacingError(error, 'No se pudo descargar la plantilla de asignaciones PILA.'),
      );
    }
  };

  const handleImport = () => {
    if (!file || !confirmed) return;
    mutation.mutate(
      { file, confirmacionAportante: confirmed },
      {
        onSuccess: (data) => {
          setResult(data);
          setFile(null);
          if (inputRef.current) inputRef.current.value = '';
        },
        onError: (error) => {
          if (error instanceof ImportError) {
            setResult({ errors: error.errors, message: error.message });
          } else {
            setResult({
              message: getUserFacingError(
                error,
                'No pudimos importar las asignaciones. Revisa la plantilla y vuelve a intentarlo.',
              ),
            });
          }
        },
      },
    );
  };

  return (
    <SideSheet
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) {
          setFile(null);
          setConfirmed(false);
          setResult(null);
          if (inputRef.current) inputRef.current.value = '';
        }
      }}
      title="Importar centros y actividad PILA"
      description="Carga asignaciones confirmadas con la ARL para empleados existentes."
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-5">
          <Button variant="outline" size="sm" onClick={handleDownload} className="w-full">
            <Download className="size-4" aria-hidden="true" />
            Descargar plantilla
          </Button>
          <Alert>
            Cada fila usa documento del empleado, ARL y código de un centro ya registrado, actividad
            de 7 dígitos y vigencia. La carga valida todo el archivo antes de escribir; las filas
            idénticas se informan sin cambios.
          </Alert>
          <p className="text-xs text-muted-foreground">
            Copia el centro y la actividad de una constancia o comunicación de la ARL. La carga no
            crea centros, no cambia sede, afiliación ni ubicación laboral, y no modifica snapshots o
            genera archivos PILA.
          </p>
          <div className="rounded-(--radius-card) border border-dashed border-border bg-canvas p-6 text-center">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0];
                if (selectedFile) {
                  setFile(selectedFile);
                  setResult(null);
                }
              }}
              className="hidden"
            />
            <Upload className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted-foreground">
              {file ? file.name : 'Selecciona un archivo .xlsx'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              className="mt-3"
            >
              Seleccionar archivo
            </Button>
          </div>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1"
            />
            Confirmo que los centros y las actividades reportados fueron verificados con la ARL para
            cada empleado y vigencia. Esta declaración quedará auditada con mi usuario.
          </label>

          {result?.errors?.length ? (
            <Alert variant="destructive">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">No se guardó ninguna asignación</p>
                  <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                    {result.errors.map((error, index) => (
                      <div
                        key={index}
                        className="rounded-md border border-destructive/25 bg-destructive/8 px-2 py-1 text-xs"
                      >
                        <span className="font-medium">Fila {error.fila}</span>
                        <span className="text-muted-foreground"> — {error.campo}</span>
                        <p className="mt-0.5">{error.mensaje}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Alert>
          ) : null}
          {result?.message && result.created === undefined && !result.errors?.length ? (
            <Alert variant="destructive">{result.message}</Alert>
          ) : null}
          {result?.created !== undefined ? (
            <Alert variant="success">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                <p className="text-sm">{result.message}</p>
              </div>
            </Alert>
          ) : null}
        </div>
        <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            {result?.created !== undefined ? 'Cerrar' : 'Cancelar'}
          </Button>
          {result?.created === undefined ? (
            <Button
              onClick={handleImport}
              disabled={!file || !confirmed || mutation.isPending}
              className="flex-1"
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Importar asignaciones
            </Button>
          ) : null}
        </div>
      </div>
    </SideSheet>
  );
}
