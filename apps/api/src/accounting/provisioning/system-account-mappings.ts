// =============================================================================
// CONTRATO — Mapeos de sistema por defecto (rol → código de cuenta)
// =============================================================================
// Lookup PURO de identidad: (rol estable) → (código PUC de la plantilla).
// AccountingProvisioningService lo usa para crear las filas CuentaSistemaMap
// del tenant, resolviendo cada `codigo` contra las cuentas YA clonadas.
//
// NO es un motor de reglas: aquí no hay condiciones, fórmulas ni prioridades
// (anti-objetivo ADR §8). La lógica de causación vive en los mappers puros de
// cada módulo (C4/C5/C6), no en esta tabla.
//
// Cada `codigo` DEBE existir y estar marcado esCuentaSistema en PUC_TEMPLATE
// (prisma/seed-data/accounting-c0.ts).
// =============================================================================

export interface SystemAccountMapping {
  rol: string;
  codigo: string;
  descripcion: string;
}

export const DEFAULT_SYSTEM_ACCOUNT_MAPPINGS: SystemAccountMapping[] = [
  // Tesorería
  { rol: 'CAJA_GENERAL', codigo: '110505', descripcion: 'Caja general' },
  {
    rol: 'BANCO_PRINCIPAL',
    codigo: '111005',
    descripcion: 'Banco principal (moneda nacional)',
  },
  // Cartera / facturación
  {
    rol: 'CLIENTES_NACIONALES',
    codigo: '130505',
    descripcion: 'Clientes nacionales (CxC)',
  },
  {
    rol: 'ANTICIPO_RETEFUENTE',
    codigo: '135515',
    descripcion: 'Retención en la fuente que nos practican (anticipo)',
  },
  {
    rol: 'IVA_GENERADO',
    codigo: '240805',
    descripcion: 'IVA generado en ventas',
  },
  {
    rol: 'RETEFUENTE_POR_PAGAR',
    codigo: '236540',
    descripcion: 'Retención en la fuente practicada por pagar',
  },
  {
    rol: 'RETEICA_POR_PAGAR',
    codigo: '236805',
    descripcion: 'ReteICA practicada por pagar',
  },
  {
    rol: 'INGRESOS_OPERACIONALES',
    codigo: '413505',
    descripcion: 'Ingresos por ventas y servicios',
  },
  // Nómina
  {
    rol: 'SALARIOS_POR_PAGAR',
    codigo: '250505',
    descripcion: 'Salarios por pagar',
  },
  {
    rol: 'APORTES_SALUD_POR_PAGAR',
    codigo: '237005',
    descripcion: 'Aportes EPS por pagar',
  },
  {
    rol: 'APORTES_PENSION_POR_PAGAR',
    codigo: '237010',
    descripcion: 'Aportes fondos de pensiones por pagar',
  },
  {
    rol: 'PROVISION_PRESTACIONES',
    codigo: '261005',
    descripcion: 'Provisión de prestaciones sociales',
  },
  { rol: 'GASTO_SUELDOS', codigo: '510506', descripcion: 'Gasto de sueldos' },
  {
    rol: 'GASTO_APORTES_SOCIALES',
    codigo: '510569',
    descripcion: 'Gasto de aportes sociales y parafiscales',
  },
  // Cierre / ajustes
  //
  // Roles de patrimonio de resultado — tres responsabilidades distintas,
  // NUNCA intercambiables:
  //
  //   UTILIDAD_EJERCICIO       → Reporting. C2 lo usa para presentar el neto
  //                              del período en el Estado de Resultados (U7).
  //                              NO es destino de asientos automáticos.
  //
  //   RESULTADO_EJERCICIO      → Cierre anual. C3 lo usa como cuenta DESTINO del
  //                              asiento de cierre anual (U4). Es la cuenta de
  //                              patrimonio que recibe el neto cancelado de las
  //                              clases 4/5/6/7. NUNCA se usa para reporting.
  //
  //   RESULTADOS_ANTERIORES    → Patrimonio acumulado. Recibe el traslado del
  //                              resultado de ejercicios anteriores (manual o vía
  //                              asiento de distribución posterior al cierre).
  {
    rol: 'UTILIDAD_EJERCICIO',
    codigo: '360505',
    descripcion: 'Utilidad del ejercicio — uso exclusivo de reporting (C2)',
  },
  {
    rol: 'RESULTADO_EJERCICIO',
    codigo: '360505',
    descripcion:
      'Resultado del ejercicio — cuenta destino del cierre anual (C3)',
  },
  {
    rol: 'RESULTADOS_ANTERIORES',
    codigo: '370505',
    descripcion: 'Resultados de ejercicios anteriores',
  },
];
