import {
  calculateServicePremium,
  ServicePremiumCorrection,
  ServicePremiumEmployee,
  ServicePremiumSnapshot,
} from './service-premium-calculator';

type TestPayrollPayload = {
  concepts: Array<{ codigo: string; tipo: string; valor: number }>;
  employee: { salarioBaseUsado: number };
};

const employee: ServicePremiumEmployee = {
  id: 'employee-1',
  fullName: 'Ana Ejemplo',
  identification: '1000000001',
  active: true,
};

function snapshot(
  month: number,
  options: {
    salary?: number;
    overtime?: number;
    aid?: number;
    aidPaid?: boolean;
    integral?: boolean;
    novelties?: Array<{ tipo: string }>;
    extraConcepts?: Array<{ codigo: string; tipo: string; valor: number }>;
    contractStart?: string;
  } = {},
): ServicePremiumSnapshot {
  const yearMonth = `2026-${String(month).padStart(2, '0')}`;
  const id = `snapshot-${month}`;
  const overtime = options.overtime ?? 0;
  return {
    id,
    employeeId: employee.id,
    payrollPeriodId: `period-${month}`,
    payloadVersion: 1,
    estadoPeriodo: 'APROBADA',
    payload: {
      period: {
        fechaInicio: `${yearMonth}-01T00:00:00.000Z`,
        fechaFin: new Date(Date.UTC(2026, month, 0)).toISOString(),
      },
      employee: {
        employeeId: employee.id,
        salarioBaseUsado: options.salary ?? 2_000_000,
        salarioIntegralUsado: options.integral ?? false,
      },
      contract: {
        contratoId: 'contract-1',
        tipo: 'TERMINO_FIJO',
        estado: 'VIGENTE',
        fechaInicio: `${options.contractStart ?? '2026-01-01'}T00:00:00.000Z`,
        fechaFin: null,
      },
      legalParameters: { auxilioTransporte: options.aid ?? 200_000 },
      novelties: options.novelties ?? [],
      concepts: [
        {
          codigo: 'SALARIO_BASE',
          tipo: 'EARNING',
          valor: options.salary ?? 2_000_000,
        },
        ...(overtime > 0
          ? [{ codigo: 'OVERTIME', tipo: 'EARNING', valor: overtime }]
          : []),
        { codigo: 'PROV_PRIMA', tipo: 'PROVISION', valor: 183_333 },
        ...(options.extraConcepts ?? []),
      ],
      totals: {
        auxilioTransporte:
          options.aidPaid === false ? 0 : (options.aid ?? 200_000),
      },
    },
  };
}

function halfYearSnapshots(options: Parameters<typeof snapshot>[1] = {}) {
  return Array.from({ length: 6 }, (_, index) => snapshot(index + 1, options));
}

describe('calculateServicePremium', () => {
  it('calcula prima fija para seis meses: $2.000.000 + $200.000 de auxilio', () => {
    const result = calculateServicePremium({
      employee,
      year: 2026,
      semester: 1,
      snapshots: halfYearSnapshots(),
    });

    expect(result).toMatchObject({
      status: 'LISTA',
      salaryBase: 2_000_000,
      variableSalary: 0,
      transportAllowance: 200_000,
      serviceDays360: 180,
      amount: 1_100_000,
    });
  });

  it('promedia trabajo suplementario desde snapshots aprobados', () => {
    const overtime = [0, 200_000, 100_000, 300_000, 0, 200_000];
    const result = calculateServicePremium({
      employee,
      year: 2026,
      semester: 1,
      snapshots: halfYearSnapshots().map((source, index) => {
        const payload = source.payload as TestPayrollPayload;
        const overtimeValue = overtime[index];
        payload.concepts = [
          ...payload.concepts,
          ...(overtimeValue
            ? [{ codigo: 'OVERTIME', tipo: 'EARNING', valor: overtimeValue }]
            : []),
        ];
        return source;
      }),
    });

    expect(result).toMatchObject({
      status: 'LISTA',
      variableSalary: 800_000 / 6,
      amount: 1_166_667,
    });
  });

  it('cuenta una fracción desde el 15 de enero con inicio incluido y fin excluido', () => {
    const result = calculateServicePremium({
      employee,
      year: 2026,
      semester: 1,
      snapshots: halfYearSnapshots({
        salary: 2_200_000,
        contractStart: '2026-01-15',
      }),
    });

    expect(result).toMatchObject({
      status: 'LISTA',
      serviceDays360: 166,
      amount: 1_106_667,
    });
  });

  it('cuenta el 30 de junio como último día de contrato del semestre', () => {
    const source = halfYearSnapshots();
    for (const item of source) {
      const payload = item.payload as TestPayrollPayload & {
        contract: {
          contratoId: string;
          tipo: string;
          estado: string;
          fechaInicio: string;
          fechaFin: string | null;
        };
      };
      payload.contract.fechaFin = '2026-06-30T00:00:00.000Z';
    }
    const result = calculateServicePremium({
      employee,
      year: 2026,
      semester: 1,
      snapshots: source,
    });

    expect(result).toMatchObject({
      status: 'LISTA',
      serviceDays360: 180,
      amount: 1_100_000,
    });
  });

  it('bloquea nóminas que cruzan el límite del semestre', () => {
    const source = halfYearSnapshots();
    const payload = source[0].payload as TestPayrollPayload & {
      period: { fechaInicio: string; fechaFin: string };
    };
    payload.period = {
      fechaInicio: '2025-12-15T00:00:00.000Z',
      fechaFin: '2026-01-14T00:00:00.000Z',
    };
    const result = calculateServicePremium({
      employee,
      year: 2026,
      semester: 1,
      snapshots: source,
    });

    expect(result).toMatchObject({
      status: 'BLOQUEADA',
      blockCode: 'PERIODO_CRUZA_SEMESTRE',
      amount: null,
    });
  });

  it('bloquea el cambio del salario fijo dentro del semestre', () => {
    const sources = halfYearSnapshots().map((source, index) => {
      const payload = source.payload as TestPayrollPayload;
      if (index >= 3) payload.employee.salarioBaseUsado = 2_400_000;
      return source;
    });
    const result = calculateServicePremium({
      employee,
      year: 2026,
      semester: 1,
      snapshots: sources,
    });
    expect(result).toMatchObject({
      status: 'BLOQUEADA',
      blockCode: 'CAMBIO_SALARIO_BASE',
      amount: null,
    });
  });

  it('bloquea una bonificación sin naturaleza salarial explícita', () => {
    const result = calculateServicePremium({
      employee,
      year: 2026,
      semester: 1,
      snapshots: halfYearSnapshots({
        extraConcepts: [{ codigo: 'BONUS', tipo: 'EARNING', valor: 100_000 }],
      }),
    });
    expect(result).toMatchObject({
      status: 'BLOQUEADA',
      blockCode: 'BONIFICACION_SIN_NATURALEZA',
    });
  });

  it.each(['SICKNESS', 'VACATION', 'OVERTIME'])(
    'mantiene 180 días para novedad %s reconocida por la matriz',
    (tipo) => {
      const result = calculateServicePremium({
        employee,
        year: 2026,
        semester: 1,
        snapshots: halfYearSnapshots({ novelties: [{ tipo }] }),
      });
      expect(result).toMatchObject({
        status: 'LISTA',
        serviceDays360: 180,
        amount: 1_100_000,
      });
    },
  );

  it.each(['LICENSE', 'OTHER', 'SUSPENSION'])(
    'bloquea la novedad %s si no tiene tratamiento aprobado para prima',
    (tipo) => {
      const result = calculateServicePremium({
        employee,
        year: 2026,
        semester: 1,
        snapshots: halfYearSnapshots({ novelties: [{ tipo }] }),
      });
      expect(result).toMatchObject({
        status: 'BLOQUEADA',
        blockCode: 'NOVEDAD_NO_CARACTERIZADA',
      });
    },
  );

  it('marca salario integral como no aplica', () => {
    const result = calculateServicePremium({
      employee,
      year: 2026,
      semester: 1,
      snapshots: halfYearSnapshots({ integral: true }),
    });
    expect(result).toMatchObject({
      status: 'NO_APLICA',
      amount: null,
      serviceDays360: 0,
    });
  });

  it('no suma auxilio si ningún snapshot acredita que se causó', () => {
    const result = calculateServicePremium({
      employee,
      year: 2026,
      semester: 1,
      snapshots: halfYearSnapshots({ salary: 2_200_000, aidPaid: false }),
    });
    expect(result).toMatchObject({
      status: 'LISTA',
      transportAllowance: 0,
      amount: 1_100_000,
    });
  });

  it('bloquea tipos de contrato fuera del MVP', () => {
    const sources = halfYearSnapshots().map((source) => {
      const payload = source.payload as Record<string, unknown>;
      payload.contract = {
        ...(payload.contract as Record<string, unknown>),
        tipo: 'PRESTACION_SERVICIOS',
      };
      return source;
    });
    expect(
      calculateServicePremium({
        employee,
        year: 2026,
        semester: 1,
        snapshots: sources,
      }),
    ).toMatchObject({
      status: 'BLOQUEADA',
      blockCode: 'TIPO_CONTRATO_NO_SOPORTADO',
    });
  });

  it('bloquea snapshots faltantes y el segundo semestre aún no habilitado', () => {
    expect(
      calculateServicePremium({
        employee,
        year: 2026,
        semester: 1,
        snapshots: halfYearSnapshots().slice(1),
      }),
    ).toMatchObject({ status: 'BLOQUEADA', blockCode: 'COBERTURA_INCOMPLETA' });
    expect(
      calculateServicePremium({
        employee,
        year: 2026,
        semester: 2,
        snapshots: halfYearSnapshots(),
      }),
    ).toMatchObject({
      status: 'BLOQUEADA',
      blockCode: 'SEMESTRE_NO_HABILITADO',
    });
  });

  it('aplica materialización aprobada de horas extra al promedio', () => {
    const corrections: ServicePremiumCorrection[] = [
      {
        id: 'correction-1',
        payrollPeriodId: 'period-1',
        status: 'APROBADA',
        intent: null,
        materialization: {
          version: 1,
          generatedAt: '2026-07-01T00:00:00.000Z',
          snapshotIds: ['snapshot-1'],
          approvedCorrectionIds: ['correction-1'],
          entries: [
            {
              snapshotId: 'snapshot-1',
              employeeId: employee.id,
              centroCostoId: null,
              concept: { codigo: 'OVERTIME', tipo: 'EARNING' },
              delta: 60_000,
            },
          ],
        },
      },
    ];
    const result = calculateServicePremium({
      employee,
      year: 2026,
      semester: 1,
      snapshots: halfYearSnapshots(),
      corrections,
    });
    expect(result).toMatchObject({
      status: 'LISTA',
      variableSalary: 10_000,
      amount: 1_105_000,
    });
    expect(result.snapshot).toMatchObject({ correctionIds: ['correction-1'] });
    expect(result.snapshot).toMatchObject({
      correctionEvidence: [
        {
          id: 'correction-1',
          payrollPeriodId: 'period-1',
          entries: [
            {
              snapshotId: 'snapshot-1',
              codigo: 'OVERTIME',
              tipo: 'EARNING',
              delta: 60_000,
            },
          ],
        },
      ],
    });
  });

  it.each([
    ['SALARIO_BASE', 'EARNING', 'CAMBIO_SALARIO_BASE'],
    ['BONUS', 'EARNING', 'BONIFICACION_SIN_NATURALEZA'],
    ['UNKNOWN_EARNING', 'EARNING', 'CORRECCION_CONCEPTO_NO_SOPORTADO'],
  ])(
    'no liquida una corrección %s sin una regla compatible',
    (codigo, tipo, blockCode) => {
      const corrections: ServicePremiumCorrection[] = [
        {
          id: 'correction-x',
          payrollPeriodId: 'period-1',
          status: 'APROBADA',
          intent: null,
          materialization: {
            version: 1,
            generatedAt: '2026-07-01T00:00:00.000Z',
            snapshotIds: ['snapshot-1'],
            approvedCorrectionIds: [],
            entries: [
              {
                snapshotId: 'snapshot-1',
                employeeId: employee.id,
                centroCostoId: null,
                concept: { codigo, tipo },
                delta: 10_000,
              },
            ],
          },
        },
      ];
      expect(
        calculateServicePremium({
          employee,
          year: 2026,
          semester: 1,
          snapshots: halfYearSnapshots(),
          corrections,
        }),
      ).toMatchObject({ status: 'BLOQUEADA', blockCode });
    },
  );

  it('bloquea correcciones pendientes o aprobadas sin materialización válida', () => {
    const source = halfYearSnapshots();
    const pending: ServicePremiumCorrection = {
      id: 'pending-1',
      payrollPeriodId: 'period-1',
      status: 'EN_REVISION',
      intent: {
        version: 1,
        intents: [
          {
            id: 'intent-1',
            kind: 'SET_CALCULATION_INPUT',
            snapshotId: 'snapshot-1',
            input: 'OVERTIME',
            targetAmount: 10,
          },
        ],
      },
      materialization: null,
    };
    const approvedInvalid: ServicePremiumCorrection = {
      ...pending,
      id: 'invalid-1',
      status: 'APROBADA',
      intent: null,
      materialization: null,
    };
    expect(
      calculateServicePremium({
        employee,
        year: 2026,
        semester: 1,
        snapshots: source,
        corrections: [pending],
      }),
    ).toMatchObject({ status: 'BLOQUEADA', blockCode: 'CORRECCION_PENDIENTE' });
    expect(
      calculateServicePremium({
        employee,
        year: 2026,
        semester: 1,
        snapshots: source,
        corrections: [approvedInvalid],
      }),
    ).toMatchObject({
      status: 'BLOQUEADA',
      blockCode: 'CORRECCION_APROBADA_SIN_MATERIALIZACION',
    });
  });
});
