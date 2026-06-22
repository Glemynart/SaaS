import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LiquidationService } from './liquidation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEmpleadoFindFirst = jest.fn();
const mockLiquidationFindFirst = jest.fn();

const mockPrisma = {
  empleado: { findFirst: mockEmpleadoFindFirst },
  liquidation: { findFirst: mockLiquidationFindFirst, create: jest.fn() },
  $transaction: jest.fn(),
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

// ── Fixture de empleado ───────────────────────────────────────────────────────

function makeEmp(overrides: Record<string, unknown> = {}) {
  return {
    id: 'emp-001',
    estado: 'RETIRADO',
    salario: 3_000_000,
    salarioIntegral: false,
    fechaIngreso: new Date('2023-01-01'),
    fechaRetiro: new Date('2023-12-31'),
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('LiquidationService — validaciones de dominio', () => {
  let service: LiquidationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        LiquidationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get(LiquidationService);
  });

  it('lanza NotFoundException cuando el empleado no existe', async () => {
    mockEmpleadoFindFirst.mockResolvedValue(null);

    await expect(
      service.createLiquidacion('tenant-1', 'user-1', 'emp-001'),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanza BadRequestException cuando estado !== RETIRADO (ACTIVO)', async () => {
    mockEmpleadoFindFirst.mockResolvedValue(makeEmp({ estado: 'ACTIVO' }));

    await expect(
      service.createLiquidacion('tenant-1', 'user-1', 'emp-001'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanza BadRequestException cuando estado !== RETIRADO (INACTIVO)', async () => {
    mockEmpleadoFindFirst.mockResolvedValue(makeEmp({ estado: 'INACTIVO' }));

    await expect(
      service.createLiquidacion('tenant-1', 'user-1', 'emp-001'),
    ).rejects.toThrow(BadRequestException);
  });

  it('el mensaje indica que solo se pueden liquidar empleados retirados', async () => {
    mockEmpleadoFindFirst.mockResolvedValue(makeEmp({ estado: 'ACTIVO' }));

    await expect(
      service.createLiquidacion('tenant-1', 'user-1', 'emp-001'),
    ).rejects.toThrow(/solo se pueden liquidar empleados retirados/i);
  });

  it('lanza BadRequestException cuando estado === RETIRADO pero fechaRetiro es null', async () => {
    mockEmpleadoFindFirst.mockResolvedValue(makeEmp({ fechaRetiro: null }));

    await expect(
      service.createLiquidacion('tenant-1', 'user-1', 'emp-001'),
    ).rejects.toThrow(BadRequestException);
  });

  it('NO lanza por estado cuando empleado está RETIRADO con fechaRetiro', async () => {
    mockEmpleadoFindFirst.mockResolvedValue(makeEmp());
    // Anti-duplicado: no hay DRAFT existente
    mockLiquidationFindFirst.mockResolvedValue(null);
    // La transacción devuelve una liquidación mínima
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma),
    );
    mockPrisma.liquidation.create.mockResolvedValue({
      id: 'liq-001',
      concepts: [],
    });

    await expect(
      service.createLiquidacion('tenant-1', 'user-1', 'emp-001'),
    ).resolves.toBeDefined();
  });
});
