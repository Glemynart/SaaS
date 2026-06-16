'use client';

import { useState, useCallback, useRef } from 'react';
import {
  useTenantBranding,
  useUpdateTenantBranding,
  useUploadLogo,
  useUploadFirma,
} from '@/features/tenant-branding/hooks/use-tenant-branding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import {
  Building2,
  Upload,
  Image as ImageIcon,
  PenLine,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function imageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
}

export default function IdentidadCorporativaPage() {
  const { data: branding, isLoading } = useTenantBranding();
  const updateMutation = useUpdateTenantBranding();
  const uploadLogoMutation = useUploadLogo();
  const uploadFirmaMutation = useUploadFirma();

  const [representante, setRepresentante] = useState('');
  const [editing, setEditing] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const firmaInputRef = useRef<HTMLInputElement>(null);

  const handleSaveRepresentante = useCallback(() => {
    updateMutation.mutate(
      { representanteLegal: representante || undefined },
      { onSuccess: () => setEditing(false) },
    );
  }, [representante, updateMutation]);

  const handleLogoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadLogoMutation.mutate(file);
    },
    [uploadLogoMutation],
  );

  const handleFirmaChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFirmaMutation.mutate(file);
    },
    [uploadFirmaMutation],
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const logoFullUrl = imageUrl(branding?.logoUrl ?? null);
  const firmaFullUrl = imageUrl(branding?.firmaRepresentanteUrl ?? null);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-lg font-semibold tracking-[-0.018em] text-foreground">
          Identidad corporativa
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configurá el logo, representante legal y firma de tu empresa. Estos datos se usarán en los
          documentos generados.
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="size-4 text-muted-foreground" />
            Datos de la empresa
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Razón social</Label>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {branding?.razonSocial ?? branding?.nombre ?? '-'}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">NIT</Label>
              <p className="mt-0.5 text-sm font-medium text-foreground">{branding?.nit ?? '-'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <PenLine className="size-4 text-muted-foreground" />
            Representante legal
          </h2>

          {editing ? (
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="representante">Nombre completo</Label>
                <Input
                  id="representante"
                  value={representante}
                  onChange={(e) => setRepresentante(e.target.value)}
                  placeholder="Ej: María Gómez Rodríguez"
                />
              </div>
              <Button onClick={handleSaveRepresentante} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Guardar
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground">
                {branding?.representanteLegal || (
                  <span className="text-muted-foreground/50 italic">No definido</span>
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRepresentante(branding?.representanteLegal ?? '');
                  setEditing(true);
                }}
              >
                {branding?.representanteLegal ? 'Editar' : 'Agregar'}
              </Button>
            </div>
          )}

          {updateMutation.isSuccess && (
            <Alert className="mt-3 py-2 text-xs">
              <CheckCircle2 className="size-3.5 text-success" />
              Representante legal actualizado.
            </Alert>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ImageIcon className="size-4 text-muted-foreground" />
              Logo empresarial
            </h2>

            <div className="mb-4 flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-surface/50">
              {logoFullUrl ? (
                <img src={logoFullUrl} alt="Logo" className="max-h-32 max-w-full object-contain" />
              ) : (
                <div className="text-center">
                  <ImageIcon className="mx-auto size-8 text-muted-foreground/30" />
                  <p className="mt-1 text-xs text-muted-foreground">Sin logo</p>
                </div>
              )}
            </div>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoChange}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full gap-1.5"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadLogoMutation.isPending}
            >
              {uploadLogoMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {logoFullUrl ? 'Cambiar logo' : 'Subir logo'}
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <PenLine className="size-4 text-muted-foreground" />
              Firma digitalizada
            </h2>

            <div className="mb-4 flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-surface/50">
              {firmaFullUrl ? (
                <img
                  src={firmaFullUrl}
                  alt="Firma"
                  className="max-h-32 max-w-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <PenLine className="mx-auto size-8 text-muted-foreground/30" />
                  <p className="mt-1 text-xs text-muted-foreground">Sin firma</p>
                </div>
              )}
            </div>

            <input
              ref={firmaInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFirmaChange}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full gap-1.5"
              size="sm"
              onClick={() => firmaInputRef.current?.click()}
              disabled={uploadFirmaMutation.isPending}
            >
              {uploadFirmaMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {firmaFullUrl ? 'Cambiar firma' : 'Subir firma'}
            </Button>
          </div>
        </div>

        {branding &&
          branding.representanteLegal &&
          branding.logoUrl &&
          branding.firmaRepresentanteUrl && (
            <Alert className="py-2 text-xs">
              <CheckCircle2 className="size-3.5 text-success" />
              Identidad corporativa completa. Las variables{' '}
              <code className="rounded bg-muted px-1 font-mono text-[0.7rem]">
                {'{{LOGO_EMPRESA}}'}
              </code>
              ,{' '}
              <code className="rounded bg-muted px-1 font-mono text-[0.7rem]">
                {'{{REPRESENTANTE_LEGAL}}'}
              </code>{' '}
              y{' '}
              <code className="rounded bg-muted px-1 font-mono text-[0.7rem]">
                {'{{FIRMA_REPRESENTANTE}}'}
              </code>{' '}
              estarán disponibles al generar documentos.
            </Alert>
          )}
      </div>
    </div>
  );
}
