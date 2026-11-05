'use client';

import { useState } from 'react';
import { AlertTriangle, Download, FileBarChart2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import {
  useCentrosCosto,
  useCuentasContables,
  useTerceros,
  useTiposComprobante,
} from '../hooks/use-accounting-configuration';
import { accountingApi, type ReportQuery } from '../services/accounting-api';
import { buildAccountingReportCsv, type AccountingReportId } from '../lib/report-csv';

type ReportId = AccountingReportId;

interface ReportOption {
  id: ReportId;
  label: string;
  path: string;
  description: string;
}

interface PaginatedReport {
  items: Record<string, unknown>[];
  total: number;
}

interface FinancialAccount {
  codigo: string;
  nombre: string;
  valor: string | number;
}

interface FinancialGroup {
  nombre: string;
  valor: string | number;
  cuentas: FinancialAccount[];
}

interface FinancialSection {
  nombre: string;
  valor: string | number;
  grupos: FinancialGroup[];
}

interface FinancialReport {
  fechaCorte?: string;
  fechaInicio?: string;
  fechaFin?: string;
  activo?: FinancialSection;
  pasivo?: FinancialSection;
  patrimonio?: FinancialSection;
  ingresos?: FinancialSection;
  costosVentas?: FinancialSection;
  costosProduccion?: FinancialSection;
  gastos?: FinancialSection;
  totalActivo?: string | number;
  totalPasivo?: string | number;
  totalPatrimonio?: string | number;
  totalPasivoPatrimonio?: string | number;
  diferencia?: string | number;
  totalIngresos?: string | number;
  totalCostos?: string | number;
  totalGastos?: string | number;
  resultadoNeto?: string | number;
}

const REPORTS: ReportOption[] = [
  {
    id: 'libro-diario',
    label: 'Libro Diario',
    path: 'libro-diario',
    description: 'Movimientos por comprobante.',
  },
  {
    id: 'libro-mayor',
    label: 'Libro Mayor',
    path: 'libro-mayor',
    description: 'Movimientos de una cuenta.',
  },
  {
    id: 'balance-prueba',
    label: 'Balance de Prueba',
    path: 'balance-prueba',
    description: 'Saldos por cuenta.',
  },
  {
    id: 'auxiliar-tercero',
    label: 'Auxiliar por tercero',
    path: 'auxiliares/tercero',
    description: 'Movimientos por tercero y cuenta.',
  },
  {
    id: 'auxiliar-centro-costo',
    label: 'Auxiliar por centro de costo',
    path: 'auxiliares/centro-costo',
    description: 'Movimientos por centro de costo y cuenta.',
  },
  {
    id: 'balance-general',
    label: 'Balance General',
    path: 'balance-general',
    description: 'Situación financiera a una fecha de corte.',
  },
  {
    id: 'estado-resultados',
    label: 'Estado de Resultados',
    path: 'estado-resultados',
    description: 'Ingresos, costos y gastos del período.',
  },
];

const PAGINATED_REPORTS: ReportId[] = [
  'libro-diario',
  'libro-mayor',
  'auxiliar-tercero',
  'auxiliar-centro-costo',
];

const toText = (value: unknown) => (value === null || value === undefined ? '—' : String(value));

function isPaginatedReport(value: unknown): value is PaginatedReport {
  return (
    value !== null && typeof value === 'object' && 'items' in value && Array.isArray(value.items)
  );
}

function FinancialSectionView({ section }: { section: FinancialSection }) {
  return (
    <section className="rounded-(--radius-card) border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-4 border-b border-border-soft pb-2">
        <h3 className="font-semibold text-foreground">{section.nombre}</h3>
        <span className="font-medium text-foreground">{toText(section.valor)}</span>
      </div>
      <div className="mt-3 space-y-3">
        {section.grupos.map((group) => (
          <div key={group.nombre}>
            <div className="flex justify-between gap-4 text-sm font-medium text-foreground">
              <span>{group.nombre}</span>
              <span>{toText(group.valor)}</span>
            </div>
            <div className="mt-1 space-y-1 pl-3 text-sm text-muted-foreground">
              {group.cuentas.map((account) => (
                <div key={account.codigo} className="flex justify-between gap-4">
                  <span>
                    {account.codigo} — {account.nombre}
                  </span>
                  <span>{toText(account.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinancialReportView({ report, type }: { report: FinancialReport; type: ReportId }) {
  const sections =
    type === 'balance-general'
      ? [report.activo, report.pasivo, report.patrimonio]
      : [report.ingresos, report.costosVentas, report.costosProduccion, report.gastos];
  const totals =
    type === 'balance-general'
      ? [
          ['Total activo', report.totalActivo],
          ['Total pasivo', report.totalPasivo],
          ['Total patrimonio', report.totalPatrimonio],
          ['Total pasivo y patrimonio', report.totalPasivoPatrimonio],
          ['Diferencia', report.diferencia],
        ]
      : [
          ['Total ingresos', report.totalIngresos],
          ['Total costos', report.totalCostos],
          ['Total gastos', report.totalGastos],
          ['Resultado neto', report.resultadoNeto],
        ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {totals.map(([label, value]) => (
          <div key={label} className="rounded-(--radius-card) border border-border bg-surface p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{toText(value)}</p>
          </div>
        ))}
      </div>
      {sections
        .filter((section): section is FinancialSection => Boolean(section))
        .map((section) => (
          <FinancialSectionView key={section.nombre} section={section} />
        ))}
    </div>
  );
}

export function ReportsManagement() {
  const [reportId, setReportId] = useState<ReportId>('libro-diario');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [fechaCorte, setFechaCorte] = useState('');
  const [tipoComprobanteId, setTipoComprobanteId] = useState('');
  const [cuentaId, setCuentaId] = useState('');
  const [terceroId, setTerceroId] = useState('');
  const [centroCostoId, setCentroCostoId] = useState('');
  const [cuentaDesde, setCuentaDesde] = useState('');
  const [cuentaHasta, setCuentaHasta] = useState('');
  const [nivel, setNivel] = useState('');
  const [incluirBorradores, setIncluirBorradores] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<unknown>();
  const [resultScope, setResultScope] = useState('');
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const { data: cuentas } = useCuentasContables({ imputable: true, activa: true });
  const { data: terceros } = useTerceros({ activo: true });
  const { data: centros } = useCentrosCosto({ activo: true });
  const { data: tipos } = useTiposComprobante();
  const selectedReport = REPORTS.find((report) => report.id === reportId)!;
  const isPaginated = PAGINATED_REPORTS.includes(reportId);
  const isFinancial = reportId === 'balance-general' || reportId === 'estado-resultados';

  const buildFilters = (nextPage: number): ReportQuery => {
    const dates = { fechaInicio: fechaInicio || undefined, fechaFin: fechaFin || undefined };
    if (reportId === 'libro-diario')
      return {
        ...dates,
        tipoComprobanteId: tipoComprobanteId || undefined,
        incluirBorradores,
        page: nextPage,
        limit: 50,
      };
    if (reportId === 'libro-mayor') return { ...dates, cuentaId, page: nextPage, limit: 50 };
    if (reportId === 'balance-prueba')
      return {
        ...dates,
        cuentaDesde: cuentaDesde || undefined,
        cuentaHasta: cuentaHasta || undefined,
        nivel: nivel ? Number(nivel) : undefined,
      };
    if (reportId === 'auxiliar-tercero')
      return { ...dates, cuentaId, terceroId, page: nextPage, limit: 50 };
    if (reportId === 'auxiliar-centro-costo')
      return { ...dates, cuentaId, centroCostoId, page: nextPage, limit: 50 };
    if (reportId === 'balance-general') return { fechaCorte: fechaCorte || undefined };
    return dates;
  };

  const runReport = async (nextPage = page) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const report = await accountingApi.reportes.get<unknown>(
        selectedReport.path,
        buildFilters(nextPage),
      );
      setResult(report);
      setResultScope(JSON.stringify({ reportId, filters: buildFilters(nextPage) }));
      setPage(nextPage);
    } catch (requestError) {
      setResult(undefined);
      setResultScope('');
      setError(
        requestError instanceof Error ? requestError.message : 'No se pudo consultar el reporte.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const selectReport = (next: ReportId) => {
    setReportId(next);
    setPage(1);
    setResult(undefined);
    setResultScope('');
    setError(undefined);
  };

  const columns: DataTableColumn<Record<string, unknown>>[] =
    reportId === 'balance-prueba'
      ? [
          { key: 'codigo', header: 'Código', render: (row) => toText(row.codigo) },
          { key: 'nombre', header: 'Cuenta', render: (row) => toText(row.nombre) },
          { key: 'totalDebito', header: 'Débito', render: (row) => toText(row.totalDebito) },
          { key: 'totalCredito', header: 'Crédito', render: (row) => toText(row.totalCredito) },
          { key: 'saldo', header: 'Saldo', render: (row) => toText(row.saldo) },
        ]
      : reportId === 'libro-diario'
        ? [
            { key: 'fecha', header: 'Fecha', render: (row) => toText(row.fecha) },
            { key: 'numero', header: 'Número', render: (row) => toText(row.numero) },
            { key: 'concepto', header: 'Concepto', render: (row) => toText(row.concepto) },
            { key: 'estado', header: 'Estado', render: (row) => toText(row.estado) },
            { key: 'totalDebito', header: 'Débito', render: (row) => toText(row.totalDebito) },
            { key: 'totalCredito', header: 'Crédito', render: (row) => toText(row.totalCredito) },
          ]
        : [
            { key: 'fecha', header: 'Fecha', render: (row) => toText(row.fecha) },
            {
              key: 'comprobanteNumero',
              header: 'Comprobante',
              render: (row) => toText(row.comprobanteNumero),
            },
            { key: 'concepto', header: 'Concepto', render: (row) => toText(row.concepto) },
            { key: 'debito', header: 'Débito', render: (row) => toText(row.debito) },
            { key: 'credito', header: 'Crédito', render: (row) => toText(row.credito) },
            { key: 'saldoCorriente', header: 'Saldo', render: (row) => toText(row.saldoCorriente) },
          ];
  const rows = Array.isArray(result)
    ? (result as Record<string, unknown>[])
    : isPaginatedReport(result)
      ? result.items
      : [];
  const total = isPaginatedReport(result) ? result.total : 0;
  const currentScope = JSON.stringify({ reportId, filters: buildFilters(page) });
  const canExport =
    result !== undefined &&
    result !== null &&
    resultScope === currentScope &&
    !isLoading &&
    (isFinancial || rows.length > 0);

  const downloadReportCsv = () => {
    if (!canExport) return;

    const csv = buildAccountingReportCsv(reportId, result);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const dateRange =
      reportId === 'balance-general'
        ? 'corte_' + (fechaCorte || 'sin_filtro')
        : 'desde_' + (fechaInicio || 'sin_filtro') + '_hasta_' + (fechaFin || 'sin_filtro');

    anchor.href = objectUrl;
    anchor.download = reportId + '_' + dateRange + (isPaginated ? '_pagina_' + page : '') + '.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Reportes contables</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulta los reportes calculados por ReportingService.
        </p>
      </div>
      <div className="grid gap-3 rounded-(--radius-card) border border-border bg-surface p-4 lg:grid-cols-3">
        <FormField label="Reporte">
          <Select
            value={reportId}
            onChange={(event) => selectReport(event.target.value as ReportId)}
          >
            {REPORTS.map((report) => (
              <option key={report.id} value={report.id}>
                {report.label}
              </option>
            ))}
          </Select>
        </FormField>
        {reportId !== 'balance-general' && (
          <FormField label="Fecha inicial">
            <Input
              type="date"
              value={fechaInicio}
              onChange={(event) => setFechaInicio(event.target.value)}
            />
          </FormField>
        )}
        {reportId === 'balance-general' ? (
          <FormField label="Fecha de corte">
            <Input
              type="date"
              value={fechaCorte}
              onChange={(event) => setFechaCorte(event.target.value)}
            />
          </FormField>
        ) : (
          <FormField label="Fecha final">
            <Input
              type="date"
              value={fechaFin}
              onChange={(event) => setFechaFin(event.target.value)}
            />
          </FormField>
        )}
        {reportId === 'libro-diario' && (
          <>
            <FormField label="Tipo de comprobante">
              <Select
                value={tipoComprobanteId}
                onChange={(event) => setTipoComprobanteId(event.target.value)}
              >
                <option value="">Todos los tipos</option>
                {tipos?.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.codigo} — {tipo.nombre}
                  </option>
                ))}
              </Select>
            </FormField>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={incluirBorradores}
                onChange={(event) => setIncluirBorradores(event.target.checked)}
              />
              Incluir borradores
            </label>
          </>
        )}
        {['libro-mayor', 'auxiliar-tercero', 'auxiliar-centro-costo'].includes(reportId) && (
          <FormField label="Cuenta" required>
            <Select value={cuentaId} onChange={(event) => setCuentaId(event.target.value)} required>
              <option value="">Selecciona una cuenta</option>
              {cuentas?.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.codigo} — {cuenta.nombre}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        {reportId === 'auxiliar-tercero' && (
          <FormField label="Tercero" required>
            <Select
              value={terceroId}
              onChange={(event) => setTerceroId(event.target.value)}
              required
            >
              <option value="">Selecciona un tercero</option>
              {terceros?.map((tercero) => (
                <option key={tercero.id} value={tercero.id}>
                  {tercero.numeroDocumento} —{' '}
                  {tercero.razonSocial ||
                    `${tercero.primerNombre ?? ''} ${tercero.primerApellido ?? ''}`}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        {reportId === 'auxiliar-centro-costo' && (
          <FormField label="Centro de costo" required>
            <Select
              value={centroCostoId}
              onChange={(event) => setCentroCostoId(event.target.value)}
              required
            >
              <option value="">Selecciona un centro</option>
              {centros?.map((centro) => (
                <option key={centro.id} value={centro.id}>
                  {centro.codigo} — {centro.nombre}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        {reportId === 'balance-prueba' && (
          <>
            <FormField label="Cuenta desde">
              <Input value={cuentaDesde} onChange={(event) => setCuentaDesde(event.target.value)} />
            </FormField>
            <FormField label="Cuenta hasta">
              <Input value={cuentaHasta} onChange={(event) => setCuentaHasta(event.target.value)} />
            </FormField>
            <FormField label="Nivel">
              <Input
                type="number"
                min="1"
                value={nivel}
                onChange={(event) => setNivel(event.target.value)}
              />
            </FormField>
          </>
        )}
        <div className="flex items-end">
          <Button
            onClick={() => runReport(1)}
            disabled={
              isLoading ||
              ((reportId === 'libro-mayor' ||
                reportId === 'auxiliar-tercero' ||
                reportId === 'auxiliar-centro-costo') &&
                !cuentaId) ||
              (reportId === 'auxiliar-tercero' && !terceroId) ||
              (reportId === 'auxiliar-centro-costo' && !centroCostoId)
            }
          >
            {isLoading ? 'Consultando…' : 'Consultar'}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{selectedReport.description}</p>
        <Button variant="outline" onClick={downloadReportCsv} disabled={!canExport}>
          <Download aria-hidden="true" className="mr-2 h-4 w-4" />
          {isPaginated ? 'Descargar página CSV' : 'Descargar reporte CSV'}
        </Button>
      </div>
      {isPaginated && canExport && (
        <p className="text-xs text-muted-foreground">
          La descarga incluye únicamente los {rows.length} registros de la página {page}.
        </p>
      )}
      {result !== undefined && resultScope !== currentScope && (
        <p className="text-xs text-muted-foreground">
          Cambiaste los filtros; consulta el reporte otra vez antes de descargarlo.
        </p>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
      {isFinancial && result && !isLoading ? (
        <FinancialReportView report={result as FinancialReport} type={reportId} />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(row) =>
            String(
              row.id ??
                row.comprobanteId ??
                `${row.codigo ?? ''}-${row.fecha ?? ''}-${row.linea ?? ''}`,
            )
          }
          isLoading={isLoading}
          empty={
            <EmptyState
              icon={result === undefined && !isLoading ? FileBarChart2 : AlertTriangle}
              title={
                result === undefined && !isLoading
                  ? 'Selecciona los filtros y consulta un reporte.'
                  : 'No se encontraron resultados.'
              }
              description={
                result === undefined && !isLoading
                  ? 'La información se obtiene directamente de ReportingService.'
                  : 'Prueba con otro rango o filtro disponible.'
              }
            />
          }
        />
      )}
      {isPaginated && isPaginatedReport(result) && (
        <Pagination
          page={page}
          total={total}
          totalPages={Math.max(1, Math.ceil(total / 50))}
          itemLabel="movimientos"
          onPageChange={runReport}
        />
      )}
    </div>
  );
}
