import {
  mapPilaAt2V30EmployerAggregateCandidate,
  mapPilaAt2V30EmployerCandidate,
} from './pila-at2-v30-employer-mapper';

type TestSnapshot = {
  employeeId: string;
  payloadVersion: number;
  payload: {
    schemaVersion: number;
    employer: {
      tenantId: string;
      pila: Record<string, unknown>;
      [key: string]: unknown;
    };
    employee: { employeeId: string };
    period: {
      payrollPeriodId: string;
      fechaInicio: string;
      fechaFin: string;
    };
  };
};

function snapshot(
  employeeId = 'employee-1',
  tenantId = 'tenant-1',
): TestSnapshot {
  return {
    employeeId,
    payloadVersion: 2,
    payload: {
      schemaVersion: 2,
      period: {
        payrollPeriodId: 'period-1',
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31',
      },
      employee: { employeeId },
      employer: {
        tenantId,
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
  it('maps snapshot data and leaves operator-assigned fields as blank candidates', () => {
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
      28: { value: null, emptyAs: 'spaces' },
      29: { value: null, emptyAs: 'spaces' },
      33: { value: 'N' },
      34: { value: 'N' },
    });
    expect(candidate.unresolvedFields).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldNumber: 28 }),
        expect.objectContaining({ fieldNumber: 29 }),
      ]),
    );
  });

  it.each([
    ['CC', '12345678901'],
    ['CE', '12345678'],
    ['TI', '123456789012'],
    ['NI', '900ABC'],
    ['SC', '123456789'],
    ['PE', '12345678901234'],
    ['PT', 'A1234567'],
    ['PC', '1234-567'],
    ['CD', 'A123456789012'],
  ])(
    'keeps invalid employer identity %s out of type 1 candidates',
    (type, identification) => {
      const input = snapshot();
      input.payload.employer.pila.tipoDocumentoAportante = type;
      input.payload.employer.nit = identification;

      const candidate = mapPilaAt2V30EmployerCandidate(input);

      expect(candidate.values[2]).toEqual({ value: type });
      expect(candidate.values[3]).toBeUndefined();
      expect(
        candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 3)
          ?.reason,
      ).toContain('no se corrige ni se trunca');
    },
  );

  it('blocks unsupported employer identity types from both candidates', () => {
    const input = snapshot();
    input.payload.employer.pila.tipoDocumentoAportante = 'ZZ';

    const candidate = mapPilaAt2V30EmployerCandidate(input);

    expect(candidate.values[2]).toBeUndefined();
    expect(candidate.values[3]).toBeUndefined();
    expect(candidate.unresolvedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldNumber: 2 }),
        expect.objectContaining({ fieldNumber: 3 }),
      ]),
    );
  });

  it('blocks an NIT declared for a natural person and invalid verification digits', () => {
    const input = snapshot();
    input.payload.employer.pila.tipoPersona = 'N';
    input.payload.employer.pila.tipoDocumentoAportante = 'NI';
    input.payload.employer.digitoVerif = '7';

    const candidate = mapPilaAt2V30EmployerCandidate(input);

    expect(candidate.values[2]).toBeUndefined();
    expect(candidate.values[3]).toBeUndefined();
    expect(candidate.values[4]).toBeUndefined();
  });

  it('blocks an unsupported representative document and invalid representative number', () => {
    const input = snapshot();
    input.payload.employer.pila.representanteTipoDocumento = 'TI';

    const unsupportedTypeCandidate = mapPilaAt2V30EmployerCandidate(input);
    expect(unsupportedTypeCandidate.values[18]).toBeUndefined();
    expect(unsupportedTypeCandidate.values[20]).toBeUndefined();

    input.payload.employer.pila.representanteTipoDocumento = 'CC';
    input.payload.employer.pila.representanteNumeroDocumento = '12345678901';
    const invalidNumberCandidate = mapPilaAt2V30EmployerCandidate(input);

    expect(invalidNumberCandidate.values[18]).toBeUndefined();
    expect(invalidNumberCandidate.values[20]).toEqual({ value: 'CC' });
  });

  it('maps aportante fields from the current PILA v3 snapshot', () => {
    const input = snapshot();
    input.payloadVersion = 3;
    input.payload.schemaVersion = 3;

    const candidate = mapPilaAt2V30EmployerCandidate(input);

    expect(candidate).toMatchObject({
      supportedSnapshot: true,
      tenantId: 'tenant-1',
    });
    expect(candidate.values[1]).toEqual({ value: 'Empresa Demo SAS' });
    expect(candidate.values[30]).toEqual({ value: '1' });
    expect(candidate.unresolvedFields).toEqual([]);
  });

  it('rejects a snapshot whose payload and schema versions disagree', () => {
    const input = snapshot();
    input.payloadVersion = 3;

    const candidate = mapPilaAt2V30EmployerCandidate(input);

    expect(candidate.supportedSnapshot).toBe(false);
    expect(candidate.unresolvedFields).toHaveLength(34);
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

  it('preserves the frozen employer name without trimming source characters', () => {
    const input = snapshot();
    input.payload.employer.razonSocial = ' Empresa Demo SAS ';

    const candidate = mapPilaAt2V30EmployerCandidate(input);

    expect(candidate.values[1]).toEqual({ value: ' Empresa Demo SAS ' });
  });

  it('keeps absent required sources unresolved and zero-fills an absent fax candidate', () => {
    const input = snapshot();
    delete input.payload.employer.pila.claseAportante;
    input.payload.employer.pila.fax = null;

    const candidate = mapPilaAt2V30EmployerCandidate(input);

    expect(candidate.values[7]).toBeUndefined();
    expect(candidate.values[16]).toEqual({ value: null, emptyAs: 'zeros' });
    expect(candidate.unresolvedFields).toEqual(
      expect.arrayContaining([expect.objectContaining({ fieldNumber: 7 })]),
    );
    expect(candidate.unresolvedFields).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ fieldNumber: 16 })]),
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

    const candidate = mapPilaAt2V30EmployerCandidate(input);

    expect(candidate.values[31]).toEqual({ value: '20200229' });
    expect(candidate.values[32]).toEqual({ value: '11' });
  });

  it('supports a PILA v4 snapshot for the existing type 1 field candidates', () => {
    const input = snapshot();
    input.payloadVersion = 4;
    input.payload.schemaVersion = 4;

    const candidate = mapPilaAt2V30EmployerCandidate(input);

    expect(candidate.supportedSnapshot).toBe(true);
  });

  it('supports a PILA v5 snapshot for the existing type 1 field candidates', () => {
    const input = snapshot();
    input.payloadVersion = 5;
    input.payload.schemaVersion = 5;

    const candidate = mapPilaAt2V30EmployerCandidate(input);

    expect(candidate.supportedSnapshot).toBe(true);
  });

  it('supports a PILA v6 snapshot for the existing type 1 field candidates', () => {
    const input = snapshot();
    input.payloadVersion = 6;
    input.payload.schemaVersion = 6;

    const candidate = mapPilaAt2V30EmployerCandidate(input);

    expect(candidate.supportedSnapshot).toBe(true);
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

describe('mapPilaAt2V30EmployerAggregateCandidate', () => {
  const period = {
    id: 'period-1',
    fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
    fechaFin: new Date('2026-10-31T00:00:00.000Z'),
  };

  it('exposes common type 1 candidates when snapshots match the approved scope', () => {
    const candidate = mapPilaAt2V30EmployerAggregateCandidate({
      expectedTenantId: 'tenant-1',
      period,
      snapshots: [snapshot('employee-1'), snapshot('employee-2')],
    });

    expect(candidate).toMatchObject({
      formatVersion: 'AT2_V30',
      supportedSnapshots: true,
      tenantId: 'tenant-1',
      payrollPeriodId: 'period-1',
      values: {
        1: { value: 'Empresa Demo SAS' },
        4: { value: '7' },
        12: { value: '001' },
        13: { value: '11' },
        33: { value: 'N' },
      },
    });
    expect(candidate.values[28]).toEqual({ value: null, emptyAs: 'spaces' });
    expect(candidate.values[29]).toEqual({ value: null, emptyAs: 'spaces' });
    expect(candidate.unresolvedFields).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldNumber: 28 }),
        expect.objectContaining({ fieldNumber: 29 }),
      ]),
    );
  });

  it('aggregates aportante candidates from PILA v3 snapshots', () => {
    const first = snapshot('employee-1');
    const second = snapshot('employee-2');
    first.payloadVersion = 3;
    first.payload.schemaVersion = 3;
    second.payloadVersion = 3;
    second.payload.schemaVersion = 3;

    const candidate = mapPilaAt2V30EmployerAggregateCandidate({
      expectedTenantId: 'tenant-1',
      period,
      snapshots: [first, second],
    });

    expect(candidate.supportedSnapshots).toBe(true);
    expect(candidate.values[1]).toEqual({ value: 'Empresa Demo SAS' });
    expect(candidate.values[30]).toEqual({ value: '1' });
    expect(candidate.unresolvedFields).toEqual([]);
  });

  it('rejects an aggregate containing inconsistent snapshot versions', () => {
    const inconsistent = snapshot('employee-2');
    inconsistent.payloadVersion = 3;

    const candidate = mapPilaAt2V30EmployerAggregateCandidate({
      expectedTenantId: 'tenant-1',
      period,
      snapshots: [snapshot(), inconsistent],
    });

    expect(candidate.supportedSnapshots).toBe(false);
    expect(candidate.values).toEqual({});
  });

  it('leaves conflicting employer values unresolved without choosing a snapshot', () => {
    const second = snapshot('employee-2');
    second.payload.employer.razonSocial = 'Otra empresa';

    const candidate = mapPilaAt2V30EmployerAggregateCandidate({
      expectedTenantId: 'tenant-1',
      period,
      snapshots: [snapshot('employee-1'), second],
    });

    expect(candidate.supportedSnapshots).toBe(true);
    expect(candidate.values[1]).toBeUndefined();
    expect(candidate.unresolvedFields).toContainEqual({
      fieldNumber: 1,
      reason:
        'El campo falta o presenta valores diferentes entre los snapshots aprobados.',
    });
    expect(candidate.values[2]).toEqual({ value: 'NI' });
  });

  it('does not expose snapshots from a tenant other than the authenticated tenant', () => {
    const candidate = mapPilaAt2V30EmployerAggregateCandidate({
      expectedTenantId: 'tenant-authenticated',
      period,
      snapshots: [snapshot('employee-1')],
    });

    expect(candidate.supportedSnapshots).toBe(false);
    expect(candidate.tenantId).toBeNull();
    expect(candidate.values).toEqual({});
    expect(candidate.unresolvedFields[0]?.reason).toContain(
      'El tenant congelado en los snapshots no coincide con el tenant autenticado.',
    );
  });

  it('fails closed when authenticated tenant context is missing', () => {
    const candidate = mapPilaAt2V30EmployerAggregateCandidate({
      expectedTenantId: null,
      period,
      snapshots: [snapshot('employee-1')],
    });

    expect(candidate.supportedSnapshots).toBe(false);
    expect(candidate.tenantId).toBeNull();
    expect(candidate.values).toEqual({});
    expect(candidate.unresolvedFields[0]?.reason).toContain(
      'Falta el contexto del tenant autenticado para confirmar el aportante.',
    );
  });

  it.each([
    {
      name: 'duplicate employee snapshots',
      snapshots: () => [snapshot('employee-1'), snapshot('employee-1')],
      expected: 'Hay más de un snapshot aprobado para el mismo empleado.',
    },
    {
      name: 'mixed tenants',
      snapshots: () => [
        snapshot('employee-1'),
        snapshot('employee-2', 'tenant-2'),
      ],
      expected: 'Los snapshots no comparten un tenant identificable.',
    },
    {
      name: 'snapshot period mismatch',
      snapshots: () => {
        const outside = snapshot('employee-2');
        outside.payload.period.payrollPeriodId = 'period-other';
        return [snapshot('employee-1'), outside];
      },
      expected:
        'El período congelado en los snapshots no coincide con el período aprobado solicitado.',
    },
    {
      name: 'snapshot date range mismatch',
      snapshots: () => {
        const outside = snapshot('employee-2');
        outside.payload.period.fechaFin = '2026-10-30';
        return [snapshot('employee-1'), outside];
      },
      expected:
        'El período congelado en los snapshots no coincide con el período aprobado solicitado.',
    },
  ])('blocks all fields for $name', ({ snapshots, expected }) => {
    const candidate = mapPilaAt2V30EmployerAggregateCandidate({
      expectedTenantId: 'tenant-1',
      period,
      snapshots: snapshots(),
    });

    expect(candidate.supportedSnapshots).toBe(false);
    expect(candidate.values).toEqual({});
    expect(candidate.unresolvedFields).toHaveLength(34);
    expect(candidate.unresolvedFields[0]?.reason).toContain(expected);
  });

  it('keeps every field pending when no approved snapshots exist', () => {
    const candidate = mapPilaAt2V30EmployerAggregateCandidate({
      expectedTenantId: 'tenant-1',
      period,
      snapshots: [],
    });

    expect(candidate.supportedSnapshots).toBe(false);
    expect(candidate.values).toEqual({});
    expect(candidate.unresolvedFields).toHaveLength(34);
    expect(candidate.unresolvedFields[0]?.reason).toContain(
      'No hay snapshots aprobados para este período.',
    );
  });
});
