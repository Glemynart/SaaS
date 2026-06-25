// =============================================================================
// SEED DATA — Motor contable ADR-001 · Fase C0
// =============================================================================
// Núcleo PUC MÍNIMO operativo (no es el Decreto 2650 completo). Cubre lo
// indispensable para facturación, nómina, cartera, tesorería y ajustes, de
// modo que C1/C4/C5/C6 puedan mapear CuentaSistemaMap contra cuentas reales.
//
// La plantilla se siembra con tenantId = NULL (global de plataforma).
// AccountingProvisioningService la clona por tenant bajo demanda.
//
// IMPORTANTE: los `codigo` marcados `sistema: true` deben permanecer alineados
// con DEFAULT_SYSTEM_ACCOUNT_MAPPINGS (src/accounting/provisioning).
// =============================================================================

export interface PucNodeSeed {
  codigo: string;
  nombre: string;
  imputable?: boolean;
  sistema?: boolean;
  requiereTercero?: boolean;
  requiereCentroCosto?: boolean;
  requiereBase?: boolean;
}

// Clase y naturaleza se derivan del primer dígito del código (PUC).
export const CLASE_BY_DIGIT: Record<string, string> = {
  '1': 'ACTIVO',
  '2': 'PASIVO',
  '3': 'PATRIMONIO',
  '4': 'INGRESOS',
  '5': 'GASTOS',
  '6': 'COSTOS_VENTAS',
  '7': 'COSTOS_PRODUCCION',
  '8': 'CUENTAS_ORDEN_DEUDORAS',
  '9': 'CUENTAS_ORDEN_ACREEDORAS',
};

export const NATURALEZA_BY_DIGIT: Record<string, string> = {
  '1': 'DEBITO',
  '2': 'CREDITO',
  '3': 'CREDITO',
  '4': 'CREDITO',
  '5': 'DEBITO',
  '6': 'DEBITO',
  '7': 'DEBITO',
  '8': 'DEBITO',
  '9': 'CREDITO',
};

// nivel y cuentaPadre se derivan de la longitud del código:
//   1 dígito → clase (nivel 1) · 2 → grupo (2) · 4 → cuenta (3) · 6 → subcuenta (4)
export function nivelOf(codigo: string): number {
  const l = codigo.length;
  if (l === 1) return 1;
  if (l === 2) return 2;
  if (l === 4) return 3;
  if (l === 6) return 4;
  return 5;
}

export function parentCodigoOf(codigo: string): string | null {
  const l = codigo.length;
  if (l <= 1) return null;
  if (l === 2) return codigo.slice(0, 1);
  if (l === 4) return codigo.slice(0, 2);
  if (l === 6) return codigo.slice(0, 4);
  return codigo.slice(0, 6);
}

// Árbol mínimo. Ancestros (clase/grupo/cuenta agrupadoras) son NO imputables;
// solo las hojas reciben movimiento (imputable) en C1.
export const PUC_TEMPLATE: PucNodeSeed[] = [
  // --- Clase 1 · ACTIVO ---
  { codigo: '1', nombre: 'Activo' },
  { codigo: '11', nombre: 'Disponible' },
  { codigo: '1105', nombre: 'Caja' },
  { codigo: '110505', nombre: 'Caja general', imputable: true, sistema: true },
  { codigo: '1110', nombre: 'Bancos' },
  {
    codigo: '111005',
    nombre: 'Bancos moneda nacional',
    imputable: true,
    sistema: true,
  },
  { codigo: '13', nombre: 'Deudores' },
  { codigo: '1305', nombre: 'Clientes' },
  {
    codigo: '130505',
    nombre: 'Clientes nacionales',
    imputable: true,
    sistema: true,
    requiereTercero: true,
  },
  { codigo: '1355', nombre: 'Anticipo de impuestos y contribuciones' },
  {
    codigo: '135515',
    nombre: 'Retención en la fuente (anticipo)',
    imputable: true,
    sistema: true,
  },

  // --- Clase 2 · PASIVO ---
  { codigo: '2', nombre: 'Pasivo' },
  { codigo: '23', nombre: 'Cuentas por pagar' },
  { codigo: '2365', nombre: 'Retención en la fuente' },
  {
    codigo: '236540',
    nombre: 'Retención en la fuente por pagar',
    imputable: true,
    sistema: true,
    requiereBase: true,
  },
  { codigo: '2368', nombre: 'Impuesto de industria y comercio retenido' },
  {
    codigo: '236805',
    nombre: 'ReteICA por pagar',
    imputable: true,
    sistema: true,
    requiereBase: true,
  },
  { codigo: '2370', nombre: 'Retenciones y aportes de nómina' },
  {
    codigo: '237005',
    nombre: 'Aportes EPS por pagar',
    imputable: true,
    sistema: true,
  },
  {
    codigo: '237010',
    nombre: 'Aportes fondos de pensiones por pagar',
    imputable: true,
    sistema: true,
  },
  { codigo: '24', nombre: 'Impuestos, gravámenes y tasas' },
  { codigo: '2408', nombre: 'Impuesto sobre las ventas por pagar' },
  {
    codigo: '240805',
    nombre: 'IVA generado',
    imputable: true,
    sistema: true,
    requiereBase: true,
  },
  { codigo: '25', nombre: 'Obligaciones laborales' },
  { codigo: '2505', nombre: 'Salarios por pagar' },
  {
    codigo: '250505',
    nombre: 'Salarios por pagar',
    imputable: true,
    sistema: true,
    requiereTercero: true,
  },
  { codigo: '26', nombre: 'Pasivos estimados y provisiones' },
  { codigo: '2610', nombre: 'Para obligaciones laborales' },
  {
    codigo: '261005',
    nombre: 'Provisión prestaciones sociales',
    imputable: true,
    sistema: true,
  },

  // --- Clase 3 · PATRIMONIO ---
  { codigo: '3', nombre: 'Patrimonio' },
  { codigo: '36', nombre: 'Resultados del ejercicio' },
  { codigo: '3605', nombre: 'Utilidad del ejercicio' },
  {
    codigo: '360505',
    nombre: 'Utilidad del ejercicio',
    imputable: true,
    sistema: true,
  },
  { codigo: '37', nombre: 'Resultados de ejercicios anteriores' },
  { codigo: '3705', nombre: 'Utilidades o excedentes acumulados' },
  {
    codigo: '370505',
    nombre: 'Utilidades acumuladas',
    imputable: true,
    sistema: true,
  },

  // --- Clase 4 · INGRESOS ---
  { codigo: '4', nombre: 'Ingresos' },
  { codigo: '41', nombre: 'Operacionales' },
  { codigo: '4135', nombre: 'Comercio al por mayor y al por menor' },
  {
    codigo: '413505',
    nombre: 'Ingresos por ventas y servicios',
    imputable: true,
    sistema: true,
    requiereTercero: true,
  },

  // --- Clase 5 · GASTOS ---
  { codigo: '5', nombre: 'Gastos' },
  { codigo: '51', nombre: 'Operacionales de administración' },
  { codigo: '5105', nombre: 'Gastos de personal' },
  {
    codigo: '510506',
    nombre: 'Sueldos',
    imputable: true,
    sistema: true,
    requiereCentroCosto: true,
  },
  {
    codigo: '510569',
    nombre: 'Aportes sociales y parafiscales',
    imputable: true,
    sistema: true,
    requiereCentroCosto: true,
  },

  // --- Clases 6–9 · nodos raíz (se profundizan a demanda) ---
  { codigo: '6', nombre: 'Costos de ventas' },
  { codigo: '7', nombre: 'Costos de producción o de operación' },
  { codigo: '8', nombre: 'Cuentas de orden deudoras' },
  { codigo: '9', nombre: 'Cuentas de orden acreedoras' },
];

// Catálogo GLOBAL de tipos de comprobante (sin tenantId, no se clona).
export interface TipoComprobanteSeed {
  codigo: string;
  nombre: string;
  prefijo: string;
}

export const TIPOS_COMPROBANTE: TipoComprobanteSeed[] = [
  { codigo: 'CI', nombre: 'Comprobante de ingreso', prefijo: 'CI' },
  { codigo: 'CE', nombre: 'Comprobante de egreso', prefijo: 'CE' },
  { codigo: 'CC', nombre: 'Comprobante de contabilidad', prefijo: 'CC' },
  { codigo: 'FV', nombre: 'Factura de venta', prefijo: 'FV' },
  { codigo: 'NC', nombre: 'Nota crédito', prefijo: 'NC' },
  { codigo: 'ND', nombre: 'Nota débito', prefijo: 'ND' },
  { codigo: 'NOM', nombre: 'Comprobante de nómina', prefijo: 'NOM' },
  { codigo: 'AJ', nombre: 'Comprobante de ajuste', prefijo: 'AJ' },
];
