export type AccountingReportId =
  | 'libro-diario'
  | 'libro-mayor'
  | 'balance-prueba'
  | 'auxiliar-tercero'
  | 'auxiliar-centro-costo'
  | 'balance-general'
  | 'estado-resultados';

type CellKind = 'text' | 'number';
type CsvCell = { value: unknown; kind: CellKind };
type ExportColumn = { header: string; key: string; kind: CellKind };

const REPORT_COLUMNS: Record<
  Exclude<AccountingReportId, 'balance-general' | 'estado-resultados'>,
  ExportColumn[]
> = {
  'libro-diario': [
    { header: 'Fecha', key: 'fecha', kind: 'text' },
    { header: 'Número', key: 'numero', kind: 'number' },
    { header: 'Concepto', key: 'concepto', kind: 'text' },
    { header: 'Estado', key: 'estado', kind: 'text' },
    { header: 'Débito', key: 'totalDebito', kind: 'number' },
    { header: 'Crédito', key: 'totalCredito', kind: 'number' },
  ],
  'libro-mayor': [
    { header: 'Fecha', key: 'fecha', kind: 'text' },
    { header: 'Comprobante', key: 'comprobanteNumero', kind: 'number' },
    { header: 'Concepto', key: 'concepto', kind: 'text' },
    { header: 'Línea', key: 'linea', kind: 'number' },
    { header: 'Débito', key: 'debito', kind: 'number' },
    { header: 'Crédito', key: 'credito', kind: 'number' },
    { header: 'Saldo corriente', key: 'saldoCorriente', kind: 'number' },
    { header: 'Tercero ID', key: 'terceroId', kind: 'text' },
    { header: 'Centro de costo ID', key: 'centroCostoId', kind: 'text' },
    { header: 'Descripción', key: 'descripcion', kind: 'text' },
  ],
  'balance-prueba': [
    { header: 'Código', key: 'codigo', kind: 'text' },
    { header: 'Cuenta', key: 'nombre', kind: 'text' },
    { header: 'Débito', key: 'totalDebito', kind: 'number' },
    { header: 'Crédito', key: 'totalCredito', kind: 'number' },
    { header: 'Saldo', key: 'saldo', kind: 'number' },
  ],
  'auxiliar-tercero': [
    { header: 'Fecha', key: 'fecha', kind: 'text' },
    { header: 'Comprobante', key: 'comprobanteNumero', kind: 'number' },
    { header: 'Concepto', key: 'concepto', kind: 'text' },
    { header: 'Línea', key: 'linea', kind: 'number' },
    { header: 'Débito', key: 'debito', kind: 'number' },
    { header: 'Crédito', key: 'credito', kind: 'number' },
    { header: 'Saldo corriente', key: 'saldoCorriente', kind: 'number' },
    { header: 'Tercero', key: 'terceroNombre', kind: 'text' },
    { header: 'Centro de costo ID', key: 'centroCostoId', kind: 'text' },
    { header: 'Descripción', key: 'descripcion', kind: 'text' },
  ],
  'auxiliar-centro-costo': [
    { header: 'Fecha', key: 'fecha', kind: 'text' },
    { header: 'Comprobante', key: 'comprobanteNumero', kind: 'number' },
    { header: 'Concepto', key: 'concepto', kind: 'text' },
    { header: 'Línea', key: 'linea', kind: 'number' },
    { header: 'Débito', key: 'debito', kind: 'number' },
    { header: 'Crédito', key: 'credito', kind: 'number' },
    { header: 'Saldo corriente', key: 'saldoCorriente', kind: 'number' },
    { header: 'Tercero ID', key: 'terceroId', kind: 'text' },
    { header: 'Código centro de costo', key: 'centroCostoCodigo', kind: 'text' },
    { header: 'Centro de costo', key: 'centroCostoNombre', kind: 'text' },
    { header: 'Descripción', key: 'descripcion', kind: 'text' },
  ],
};

const FINANCIAL_SECTIONS: Record<
  'balance-general' | 'estado-resultados',
  { key: string; label: string }[]
> = {
  'balance-general': [
    { key: 'activo', label: 'Activo' },
    { key: 'pasivo', label: 'Pasivo' },
    { key: 'patrimonio', label: 'Patrimonio' },
  ],
  'estado-resultados': [
    { key: 'ingresos', label: 'Ingresos' },
    { key: 'costosVentas', label: 'Costos de ventas' },
    { key: 'costosProduccion', label: 'Costos de producción' },
    { key: 'gastos', label: 'Gastos' },
  ],
};

const FINANCIAL_TOTALS: Record<
  'balance-general' | 'estado-resultados',
  { key: string; label: string }[]
> = {
  'balance-general': [
    { key: 'totalActivo', label: 'Total activo' },
    { key: 'totalPasivo', label: 'Total pasivo' },
    { key: 'totalPatrimonio', label: 'Total patrimonio' },
    { key: 'totalPasivoPatrimonio', label: 'Total pasivo y patrimonio' },
    { key: 'diferencia', label: 'Diferencia' },
  ],
  'estado-resultados': [
    { key: 'totalIngresos', label: 'Total ingresos' },
    { key: 'totalCostos', label: 'Total costos' },
    { key: 'totalGastos', label: 'Total gastos' },
    { key: 'resultadoNeto', label: 'Resultado neto' },
  ],
};

export function buildAccountingReportCsv(reportId: AccountingReportId, result: unknown): string {
  if (reportId === 'balance-general' || reportId === 'estado-resultados') {
    return buildFinancialReportCsv(reportId, result);
  }

  const columns = REPORT_COLUMNS[reportId];
  const rows = getRows(result);
  const csvRows = rows.map((row) =>
    columns.map((column) => ({
      value: row[column.key],
      kind: column.kind,
    })),
  );

  return serializeCsv(
    columns.map((column) => column.header),
    csvRows,
  );
}

function buildFinancialReportCsv(
  reportId: 'balance-general' | 'estado-resultados',
  result: unknown,
): string {
  const report = asRecord(result);
  const rows: CsvCell[][] = [];

  for (const definition of FINANCIAL_SECTIONS[reportId]) {
    const section = asRecord(report?.[definition.key]);
    if (!section) continue;

    rows.push([
      { value: 'Sección', kind: 'text' },
      { value: section.nombre ?? definition.label, kind: 'text' },
      { value: section.codigo, kind: 'text' },
      { value: '', kind: 'text' },
      { value: section.valor, kind: 'number' },
    ]);

    for (const groupValue of Array.isArray(section.grupos) ? section.grupos : []) {
      const group = asRecord(groupValue);
      if (!group) continue;
      rows.push([
        { value: 'Grupo', kind: 'text' },
        { value: section.nombre ?? definition.label, kind: 'text' },
        { value: group.codigo, kind: 'text' },
        { value: group.nombre, kind: 'text' },
        { value: group.valor, kind: 'number' },
      ]);

      for (const accountValue of Array.isArray(group.cuentas) ? group.cuentas : []) {
        const account = asRecord(accountValue);
        if (!account) continue;
        rows.push([
          { value: 'Cuenta', kind: 'text' },
          { value: section.nombre ?? definition.label, kind: 'text' },
          { value: account.codigo, kind: 'text' },
          { value: account.nombre, kind: 'text' },
          { value: account.valor, kind: 'number' },
        ]);
      }
    }
  }

  for (const total of FINANCIAL_TOTALS[reportId]) {
    rows.push([
      { value: 'Total', kind: 'text' },
      { value: '', kind: 'text' },
      { value: '', kind: 'text' },
      { value: total.label, kind: 'text' },
      { value: report?.[total.key], kind: 'number' },
    ]);
  }

  return serializeCsv(['Nivel', 'Sección', 'Código', 'Cuenta o grupo', 'Valor'], rows);
}

function getRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result.filter(isRecord);
  }

  const record = asRecord(result);
  return Array.isArray(record?.items) ? record.items.filter(isRecord) : [];
}

function serializeCsv(headers: string[], rows: CsvCell[][]): string {
  const encodedRows = [
    headers.map((header) => encodeText(header)).join(';'),
    ...rows.map((row) => row.map(encodeCell).join(';')),
  ];

  return '\uFEFF' + encodedRows.join('\r\n') + '\r\n';
}

function encodeCell(cell: CsvCell): string {
  if (cell.value === null || cell.value === undefined) return '';
  if (cell.kind === 'number') return encodeNumber(cell.value);
  return encodeText(String(cell.value));
}

function encodeNumber(value: unknown): string {
  const raw = String(value);
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) {
    return encodeText(raw);
  }
  return raw.replace('.', ',');
}

function encodeText(value: string): string {
  const safe = /^[\u0000-\u0020]*[=+\-@]/.test(value) ? "'" + value : value;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
