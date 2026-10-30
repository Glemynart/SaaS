import { DEFAULT_SYSTEM_ACCOUNT_MAPPINGS } from './system-account-mappings';
import { PUC_TEMPLATE } from '../../../prisma/seed-data/accounting-c0';

// Blinda el contrato seed ↔ clonado: la provisión resuelve rol → codigo contra
// las cuentas clonadas. Si un mapeo apunta a un código inexistente o no
// imputable / no de sistema, clonarPlanDeCuentas fallaría en runtime.
describe('DEFAULT_SYSTEM_ACCOUNT_MAPPINGS', () => {
  const porCodigo = new Map(PUC_TEMPLATE.map((c) => [c.codigo, c]));

  it('cada rol es único', () => {
    const roles = DEFAULT_SYSTEM_ACCOUNT_MAPPINGS.map((m) => m.rol);
    expect(new Set(roles).size).toBe(roles.length);
  });

  it.each(DEFAULT_SYSTEM_ACCOUNT_MAPPINGS)(
    'rol $rol → cuenta $codigo existe, es imputable y de sistema',
    ({ codigo }) => {
      const cuenta = porCodigo.get(codigo);
      expect(cuenta).toBeDefined();
      expect(cuenta?.imputable).toBe(true);
      expect(cuenta?.sistema).toBe(true);
    },
  );

  it('toda cuenta de sistema imputable de la plantilla tiene su mapeo', () => {
    const codigosMapeados = new Set(
      DEFAULT_SYSTEM_ACCOUNT_MAPPINGS.map((m) => m.codigo),
    );
    const sistemaSinMapear = PUC_TEMPLATE.filter(
      (c) => c.sistema && c.imputable && !codigosMapeados.has(c.codigo),
    );
    expect(sistemaSinMapear).toEqual([]);
  });

  it('mapea aportes y provisiones de nómina a las cuentas PUC específicas', () => {
    const porRol = Object.fromEntries(
      DEFAULT_SYSTEM_ACCOUNT_MAPPINGS.map((mapping) => [
        mapping.rol,
        mapping.codigo,
      ]),
    );

    expect(porRol).toEqual(
      expect.objectContaining({
        APORTES_SALUD_POR_PAGAR: '237005',
        APORTES_RIESGOS_LABORALES_POR_PAGAR: '237006',
        APORTES_PARAFISCALES_POR_PAGAR: '237010',
        APORTES_PENSION_POR_PAGAR: '238030',
        PROVISION_CESANTIAS_POR_PAGAR: '261005',
        PROVISION_INTERESES_CESANTIAS_POR_PAGAR: '261010',
        PROVISION_VACACIONES_POR_PAGAR: '261015',
        PROVISION_PRIMA_POR_PAGAR: '261020',
        GASTO_APORTES_RIESGOS_LABORALES: '510568',
        GASTO_APORTES_SALUD: '510569',
        GASTO_APORTES_PENSION: '510570',
        GASTO_APORTES_CAJA: '510572',
        GASTO_APORTES_ICBF: '510575',
        GASTO_APORTES_SENA: '510578',
        GASTO_PROVISION_CESANTIAS: '510530',
        GASTO_PROVISION_INTERESES_CESANTIAS: '510533',
        GASTO_PROVISION_PRIMA: '510536',
        GASTO_PROVISION_VACACIONES: '510539',
      }),
    );
  });
});
