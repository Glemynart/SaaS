import { mapPilaAt2V30EmployerCandidate } from './pila-at2-v30-employer-mapper';

type TestSnapshot = {
  payloadVersion: number;
  payload: {
    schemaVersion: number;
    employer: {
      tenantId: string;
      pila: Record<string, unknown>;
      [key: string]: unknown;
    };
  };
};

function snapshot(): TestSnapshot {
  return {
    payloadVersion: 2,
    payload: {
      schemaVersion: 2,
      employer: {
        tenantId: 'tenant-1',
        razonSocial: 'Empresa Demo SAS',
        nit: '900123456',
        digitoVerif: '7',
        direccion: 'Calle Demo 10',
        telefono: '6011234567',
        email: null,
        aportesExonerados: false,
        municipio: { codigo: '11001' },
        pila: {
          tipoDocumentoAportante: 'NI',
          claseAportante: 'B',
          naturalezaJuridica: '2',
          tipoPersona: 'J',
          formaPresentacion: 'U',
          codigoActividadEconomica: '1234',
          tipoAportante: '1',
          fax: '6011234567',
          representanteTipoDocumento: 'CC',
          representanteNumeroDocumento: '123456789',
          representantePrimerApellido: 'Demo',
          representanteSegundoApellido: null,
          representantePrimerNombre: 'Ana',
          representanteSegundoNombre: null,
          beneficioLey1429: false,
          beneficioCcfLey1429: false,
          aportesExoneradosConfirmado: false,
          sinAccionEspecial: true,
        },
      },
    },
  };
}

describe('mapPilaAt2V30EmployerCandidate', () => {
  it('maps explicit employer snapshot sources and leaves operator fields unresolved', () => {
    const candidate = mapPilaAt2V30EmployerCandidate(snapshot());

    expect(candidate).toMatchObject({
      formatVersion: 'AT2_V30',
      supportedSnapshot: true,
      tenantId: 'tenant-1',
    });
    expect(candidate.values).toMatchObject({
      1: { value: 'Empresa Demo SAS' },
      2: { value: 'NI' },
      3: { value: '900123456' },
      4: { value: '7' },
      5: { value: null, emptyAs: 'spaces' },
      6: { value: null, emptyAs: 'spaces' },
      7: { value: 'B' },
      12: { value: '001' },
      13: { value: '11' },
      17: { value: null, emptyAs: 'spaces' },
      19: { value: '0' },
      22: { value: null, emptyAs: 'spaces' },
      24: { value: null, emptyAs: 'spaces' },
      26: { value: '0' },
      33: { value: 'N' },
      34: { value: 'N' },
    });
    expect(candidate.values[28]).toBeUndefined();
    expect(candidate.values[29]).toBeUndefined();
    expect(candidate.unresolvedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldNumber: 28 }),
        expect.objectContaining({ fieldNumber: 29 }),
      ]),
    );
  });

  it('uses the declared branch code as the name fallback for branch presentation', () => {
    const input = snapshot();
    input.payload.employer.pila.formaPresentacion = 'S';
    input.payload.employer.pila.codigoSucursal = 'SUC01';
    input.payload.employer.pila.nombreSucursal = null;

    const candidate = mapPilaAt2V30EmployerCandidate(input);

    expect(candidate.values[5]).toEqual({ value: 'SUC01' });
    expect(candidate.values[6]).toEqual({ value: 'SUC01' });
  });

  it('keeps absent required sources and an unconfirmed fax unresolved', () => {
    const input = snapshot();
    delete input.payload.employer.pila.claseAportante;
    input.payload.employer.pila.fax = null;

    const candidate = mapPilaAt2V30EmployerCandidate(input);

    expect(candidate.values[7]).toBeUndefined();
    expect(candidate.values[16]).toBeUndefined();
    expect(candidate.unresolvedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldNumber: 7 }),
        expect.objectContaining({ fieldNumber: 16 }),
      ]),
    );
  });

  it('only emits the natural-person DV and omits representative data for a natural person', () => {
    const input = snapshot();
    input.payload.employer.pila.tipoPersona = 'N';
    input.payload.employer.pila.tipoDocumentoAportante = 'CC';
    input.payload.employer.digitoVerif = '0';

    const candidate = mapPilaAt2V30EmployerCandidate(input);

    expect(candidate.values[4]).toEqual({ value: '0' });
    expect(candidate.values[18]).toEqual({ value: null, emptyAs: 'spaces' });
    expect(candidate.values[19]).toEqual({ value: '0' });
    expect(candidate.values[20]).toEqual({ value: null, emptyAs: 'spaces' });
  });

  it('maps the Ley 1429 fields only when the benefit is explicitly declared', () => {
    const input = snapshot();
    input.payload.employer.pila.beneficioLey1429 = true;
    input.payload.employer.pila.fechaMatriculaMercantil = '2020-02-29';
    input.payload.employer.pila.codigoDepartamentoLey1429 = '11';

    const candidate = mapPilaAt2V30EmployerCandidate(input);

    expect(candidate.values[31]).toEqual({ value: '20200229' });
    expect(candidate.values[32]).toEqual({ value: '11' });
  });

  it('does not map an unsupported or unattributed snapshot', () => {
    const input = snapshot();
    input.payloadVersion = 1;

    const candidate = mapPilaAt2V30EmployerCandidate(input);

    expect(candidate.supportedSnapshot).toBe(false);
    expect(candidate.values).toEqual({});
    expect(
      candidate.unresolvedFields.map(({ fieldNumber }) => fieldNumber),
    ).toEqual(Array.from({ length: 34 }, (_, index) => index + 1));
  });
});
