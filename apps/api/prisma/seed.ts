import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await seedParametrosLegales2026();
}

/**
 * Siembra los parámetros legales de nómina colombiana para la vigencia 2026.
 * Idempotente: usa upsert con clave (tenantId=NULL, vigenciaDesde=2026-01-01).
 * Fuente: Decreto 2613 del 27 de diciembre de 2024 (SMMLV) y
 *         Decreto 2614 del 27 de diciembre de 2024 (auxilio de transporte).
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

    smmlv: 1423500, // COP — Decreto 2613/2024
    auxilioTransporte: 202897, // COP — Decreto 2614/2024
    uvt: 49799, // COP — Resolución 000187/2024 DIAN

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

    fspTramos,

    fuente:
      'Decreto 2613/2024 (SMMLV); Decreto 2614/2024 (auxilio); ' +
      'Res. 000187/2024 DIAN (UVT); Ley 100/1993 Art. 27 (FSP); ' +
      'Art. 114-1 ET (exoneración)',
    notas:
      'Tarifas ARL según Decreto 1072/2015 Tabla I. ' +
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
