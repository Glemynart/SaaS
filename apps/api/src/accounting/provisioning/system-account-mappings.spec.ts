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
});
