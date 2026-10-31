import {
  PrismaClient,
  ClaseContable,
  NaturalezaContable,
} from '@prisma/client';
import {
  PUC_TEMPLATE,
  TIPOS_COMPROBANTE,
  CLASE_BY_DIGIT,
  NATURALEZA_BY_DIGIT,
  nivelOf,
  parentCodigoOf,
} from './seed-data/accounting-c0';

const prisma = new PrismaClient();

async function main() {
  await seedParametrosLegales2026();
  await seedTiposComprobante();
  await seedPucPlantilla();
}

/**
 * Siembra el catálogo GLOBAL de tipos de comprobante (sin tenantId).
 * Idempotente: upsert por `codigo` (único global).
 */
async function seedTiposComprobante() {
  for (const t of TIPOS_COMPROBANTE) {
    await prisma.tipoComprobante.upsert({
      where: { codigo: t.codigo },
      update: { nombre: t.nombre, prefijo: t.prefijo },
      create: { codigo: t.codigo, nombre: t.nombre, prefijo: t.prefijo },
    });
  }
  console.log(`✓ TipoComprobante global: ${TIPOS_COMPROBANTE.length} tipos`);
}

/**
 * Siembra la plantilla PUC global (tenantId = NULL).
 * Idempotente: findFirst + create/update por (tenantId NULL, codigo), porque
 * Prisma no admite tenantId nullable en el where de upsert compuesto.
 * Crea de menor a mayor profundidad para resolver cuentaPadreId por código.
 */
async function seedPucPlantilla() {
  const ordenados = [...PUC_TEMPLATE].sort(
    (a, b) =>
      a.codigo.length - b.codigo.length || a.codigo.localeCompare(b.codigo),
  );

  const idPorCodigo = new Map<string, string>();

  for (const nodo of ordenados) {
    const digito = nodo.codigo[0];
    const padreCodigo = parentCodigoOf(nodo.codigo);
    const cuentaPadreId = padreCodigo
      ? (idPorCodigo.get(padreCodigo) ?? null)
      : null;

    const data = {
      nombre: nodo.nombre,
      claseContable: CLASE_BY_DIGIT[digito] as ClaseContable,
      naturaleza: NATURALEZA_BY_DIGIT[digito] as NaturalezaContable,
      nivel: nivelOf(nodo.codigo),
      cuentaPadreId,
      imputable: nodo.imputable ?? false,
      esCuentaSistema: nodo.sistema ?? false,
      requiereTercero: nodo.requiereTercero ?? false,
      requiereCentroCosto: nodo.requiereCentroCosto ?? false,
      requiereBase: nodo.requiereBase ?? false,
    };

    const existing = await prisma.cuentaContable.findFirst({
      where: { tenantId: null, codigo: nodo.codigo },
      select: { id: true },
    });

    if (existing) {
      await prisma.cuentaContable.update({ where: { id: existing.id }, data });
      idPorCodigo.set(nodo.codigo, existing.id);
    } else {
      const creada = await prisma.cuentaContable.create({
        data: { tenantId: null, codigo: nodo.codigo, ...data },
        select: { id: true },
      });
      idPorCodigo.set(nodo.codigo, creada.id);
    }
  }

  console.log(`✓ Plantilla PUC global: ${ordenados.length} cuentas`);
}

/**
 * Siembra los parámetros legales de nómina colombiana para la vigencia 2026.
 * Idempotente: usa upsert con clave (tenantId=NULL, vigenciaDesde=2026-01-01).
 * Fuentes: Decreto 1469/2025 (SMMLV), Decreto 1470/2025 (auxilio de
 * transporte) y Resolución DIAN 000238/2025 (UVT). El 17-07-2026 el Consejo
 * de Estado revocó la suspensión provisional del Decreto 1469/2025; seguía
 * vigente al actualizar este seed, pendiente el fallo de fondo.
 */
async function seedParametrosLegales2026() {
  const vigenciaDesde = new Date('2026-01-01');

  // FSP tramos (Ley 100 Art. 27, Ley 797/2003 Art. 5)
  // pct = tasa TOTAL del tramo (no adicional), expresada como fracción
  const fspTramos = [
    { desdeSmmlv: 0, hastaSmmlv: 4, pct: 0 }, // < 4 SMMLV: exento
    { desdeSmmlv: 4, hastaSmmlv: 16, pct: 0.01 }, // 4–16 SMMLV: 1%
    { desdeSmmlv: 16, hastaSmmlv: 17, pct: 0.012 }, // 16–17 SMMLV: 1.2%
    { desdeSmmlv: 17, hastaSmmlv: 18, pct: 0.014 }, // 17–18 SMMLV: 1.4%
    { desdeSmmlv: 18, hastaSmmlv: 19, pct: 0.016 }, // 18–19 SMMLV: 1.6%
    { desdeSmmlv: 19, hastaSmmlv: 20, pct: 0.018 }, // 19–20 SMMLV: 1.8%
    { desdeSmmlv: 20, hastaSmmlv: null, pct: 0.02 }, // ≥ 20 SMMLV: 2%
  ];

  const data = {
    tenantId: null,
    vigenciaDesde,
    vigenciaHasta: null, // Vigencia abierta (la más reciente)
    anio: 2026,

    smmlv: 1_750_905, // COP — Decreto 1469/2025
    auxilioTransporte: 249_095, // COP — Decreto 1470/2025
    uvt: 52_374, // COP — Resolución 000238/2025 DIAN

    topeIbcMinSmmlv: 1,
    topeIbcMaxSmmlv: 25,
    umbralAuxilioSmmlv: 2, // ≤ 2 SMMLV recibe auxilio
    umbralExoneracionSmmlv: 10, // Art. 114-1 ET: < 10 SMMLV

    pctSaludEmpleado: 0.04, // 4%
    pctPensionEmpleado: 0.04, // 4%

    pctSaludEmpleador: 0.085, // 8.5% (exonerable Art. 114-1)
    pctPensionEmpleador: 0.12, // 12%
    pctCaja: 0.04, // 4%  (NUNCA exonerable)
    pctIcbf: 0.03, // 3%  (exonerable)
    pctSena: 0.02, // 2%  (exonerable)

    arlClaseI: 0.00522, // 0.522% — riesgo mínimo
    arlClaseII: 0.01044, // 1.044% — riesgo bajo
    arlClaseIII: 0.02436, // 2.436% — riesgo medio
    arlClaseIV: 0.0435, // 4.35%  — riesgo alto
    arlClaseV: 0.0696, // 6.96%  — riesgo máximo

    // Factores de provisión prestacional mensual (fracción) — antes hardcoded
    // en el PayrollCalculator; externalizados a parámetro legal versionado (P0).
    factorProvPrima: 0.0833, // Prima de servicios (CST Art. 306): 30/360 ≈ 8.33%
    factorProvCesantias: 0.0833, // Cesantías (CST Art. 249): 30/360 ≈ 8.33%
    factorProvIntCesantias: 0.01, // Intereses sobre cesantías (Ley 52/1975): ≈ 1% mensual
    factorProvVacaciones: 0.0417, // Vacaciones (CST Art. 186): 15/360 ≈ 4.17%

    fspTramos,

    fuente:
      'Decreto 1469/2025 (SMMLV); Decreto 1470/2025 (auxilio); ' +
      'Res. 000238/2025 DIAN (UVT); Ley 100/1993 Art. 27 (FSP); ' +
      'Art. 114-1 ET (exoneración)',
    notas:
      'Valores 2026 revalidados el 2026-10-30. El Consejo de Estado revocó ' +
      'la suspensión provisional del Decreto 1469/2025 el 2026-07-17; el ' +
      'proceso de fondo seguía pendiente al corte. Tarifas ARL según ' +
      'Decreto 1072/2015 Tabla I. ' +
      'Caja siempre se paga (no aplica Art. 114-1). ' +
      'FSP: tramos expresan tasa total del tramo, no tasa adicional.',
  };

  // Prisma no puede usar @@unique con campo nullable en el where de upsert
  // cuando tenantId es null. Usamos findFirst + create/update explícito.
  const existing = await prisma.parametroLegalNomina.findFirst({
    where: { tenantId: null, vigenciaDesde },
  });

  if (existing) {
    await prisma.parametroLegalNomina.update({
      where: { id: existing.id },
      data,
    });
    console.log('✓ ParametroLegalNomina 2026 actualizado (global)');
  } else {
    await prisma.parametroLegalNomina.create({ data });
    console.log('✓ ParametroLegalNomina 2026 creado (global)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
