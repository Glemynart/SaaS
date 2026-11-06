import { composePilaAt2V30FilesFromApprovedSnapshots } from './pila-at2-v30-snapshot-export';
import { PilaAt2V30FileExportBlockedError } from './pila-at2-v30-file-export';
import { completeApprovedSnapshot } from '../../test/fixtures/pila-at2-v30-approved-snapshot';

function approvedFirstDayVspSnapshot() {
  const snapshot = completeApprovedSnapshot();
  snapshot.payloadVersion = 10;
  const payload = snapshot.payload as {
    schemaVersion: number;
    contract: Record<string, unknown>;
    pilaEvents: Array<Record<string, unknown>>;
    payroll: Record<string, unknown>;
  };
  payload.schemaVersion = 10;
  payload.contract.tipo = 'TERMINO_INDEFINIDO';
  const event = {
    eventId: 'pila-vsp-event-1',
    codigo: 'VSP',
    fechaInicio: '2026-10-01',
    fechaFin: null,
    dias: null,
  };
  payload.pilaEvents = [event];
  payload.payroll.pilaEvents = [event];
  payload.payroll.salarioIntegral = false;
  payload.payroll.diasNomina = 30;
  return snapshot;
}

describe('composePilaAt2V30FilesFromApprovedSnapshots', () => {
  it('composes both files from one complete, approved dependent 01/00 snapshot', () => {
    let files;
    try {
      files = composePilaAt2V30FilesFromApprovedSnapshots({
        expectedTenantId: 'tenant-1',
        expectedEmployeeIds: ['employee-1'],
        period: {
          id: 'period-1',
          fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
          fechaFin: new Date('2026-10-31T00:00:00.000Z'),
        },
        snapshots: [completeApprovedSnapshot()],
      });
    } catch (error) {
      if (error instanceof PilaAt2V30FileExportBlockedError) {
        throw new Error(JSON.stringify(error.issues, null, 2));
      }
      throw error;
    }

    expect(files.recordCounts).toEqual({ type1: 1, type2: 2, details: 1 });
    expect(files.type1File.length).toBe(567);
    expect(files.type2File.length).toBe(359 + 2 + 693);
    expect(files.operatorCompatibilityStatus).toBe('NOT_VERIFIED');
  });

  it('rejects snapshots that do not match the approved run set', () => {
    expect(() =>
      composePilaAt2V30FilesFromApprovedSnapshots({
        expectedTenantId: 'tenant-1',
        expectedEmployeeIds: ['employee-1', 'employee-2'],
        period: {
          id: 'period-1',
          fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
          fechaFin: new Date('2026-10-31T00:00:00.000Z'),
        },
        snapshots: [completeApprovedSnapshot()],
      }),
    ).toThrow(PilaAt2V30FileExportBlockedError);
  });

  it('composes files from an approved first-day full-month VSP snapshot', () => {
    let files;
    try {
      files = composePilaAt2V30FilesFromApprovedSnapshots({
        expectedTenantId: 'tenant-1',
        expectedEmployeeIds: ['employee-1'],
        period: {
          id: 'period-1',
          fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
          fechaFin: new Date('2026-10-31T00:00:00.000Z'),
        },
        snapshots: [approvedFirstDayVspSnapshot()],
      });
    } catch (error) {
      if (error instanceof PilaAt2V30FileExportBlockedError) {
        throw new Error(JSON.stringify(error.issues, null, 2));
      }
      throw error;
    }

    const type2 = files.type2File.toString('latin1').split('\r\n');
    expect(files.recordCounts).toEqual({ type1: 1, type2: 2, details: 1 });
    expect(type2).toHaveLength(2);
    expect(type2[1]).toHaveLength(693);
  });
});
