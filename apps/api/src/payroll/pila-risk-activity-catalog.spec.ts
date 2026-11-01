import {
  PILA_RISK_ACTIVITY_CATALOG_SOURCE_SHA256,
  PILA_RISK_ACTIVITY_CATALOG_VERSION,
  PILA_RISK_ACTIVITY_CODES,
} from './pila-risk-activity-catalog';

describe('catálogo de actividad económica ARL Decreto 768 de 2022', () => {
  it('conserva el catálogo versionado y cada código tiene 7 dígitos con clase de riesgo inicial', () => {
    expect(PILA_RISK_ACTIVITY_CATALOG_VERSION).toBe('DECRETO_768_2022');
    expect(PILA_RISK_ACTIVITY_CATALOG_SOURCE_SHA256).toBe(
      'b1280c5a07be085cf7bba6eef5c988ae1b83151460184d20d7e22830bfd47883',
    );
    expect(PILA_RISK_ACTIVITY_CODES.size).toBe(1018);
    for (const code of PILA_RISK_ACTIVITY_CODES) {
      expect(code).toMatch(/^[1-5]\d{6}$/);
    }
  });

  it('reconoce códigos del anexo y rechaza códigos inventados', () => {
    expect(PILA_RISK_ACTIVITY_CODES.has('1131202')).toBe(true);
    expect(PILA_RISK_ACTIVITY_CODES.has('2016101')).toBe(true);
    expect(PILA_RISK_ACTIVITY_CODES.has('1999999')).toBe(false);
  });
});
