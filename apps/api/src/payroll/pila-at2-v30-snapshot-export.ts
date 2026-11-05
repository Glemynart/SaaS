import { mapPilaAt2V30DetailCandidate } from './pila-at2-v30-detail-mapper';
import { mapPilaAt2V30EmployerAggregateCandidate } from './pila-at2-v30-employer-mapper';
import { mapPilaAt2V30HeaderCandidate } from './pila-at2-v30-header-mapper';
import type { PilaSnapshotPreparationInput } from './pila-preparation';
import { sequencePilaAt2V30DetailCandidates } from './pila-at2-v30-detail-sequencer';
import {
  composePilaAt2V30LocalFiles,
  type PilaAt2V30FileCandidates,
  type PilaAt2V30LocalFiles,
} from './pila-at2-v30-file-export';

export interface PilaAt2V30ApprovedSnapshotScope {
  expectedTenantId: string;
  expectedEmployeeIds: readonly string[] | null;
  period: {
    id: string;
    fechaInicio: Date;
    fechaFin: Date;
  };
  snapshots: readonly PilaSnapshotPreparationInput[];
}

export function buildPilaAt2V30FileCandidates(
  input: PilaAt2V30ApprovedSnapshotScope,
): PilaAt2V30FileCandidates {
  const header = mapPilaAt2V30HeaderCandidate({
    expectedTenantId: input.expectedTenantId,
    period: input.period,
    snapshots: input.snapshots,
  });
  const employer = mapPilaAt2V30EmployerAggregateCandidate({
    expectedTenantId: input.expectedTenantId,
    period: input.period,
    snapshots: input.snapshots.map((snapshot) => ({
      ...snapshot,
      employeeId: snapshot.employeeId,
    })),
  });
  const planillaType =
    typeof header.values[8]?.value === 'string' ? header.values[8].value : null;
  const details = input.snapshots.map((snapshot) =>
    mapPilaAt2V30DetailCandidate(snapshot, {
      expectedTenantId: input.expectedTenantId,
      planillaType,
      period: input.period,
    }),
  );
  const sequence = sequencePilaAt2V30DetailCandidates(
    details,
    input.expectedEmployeeIds,
  );
  if (sequence.status === 'CANDIDATE') {
    const sequenceByEmployeeId = new Map(
      sequence.assignments.map(({ employeeId, sequence: assigned }) => [
        employeeId,
        assigned,
      ]),
    );
    for (const detail of details) {
      const assigned = sequenceByEmployeeId.get(detail.employeeId);
      if (assigned === undefined) continue;
      detail.values[2] = { value: assigned };
      detail.normativeRuleVersions.detailRecordSequence = sequence.ruleVersion;
      detail.unresolvedFields = detail.unresolvedFields.filter(
        ({ fieldNumber }) => fieldNumber !== 2,
      );
    }
  }

  return {
    employer,
    header,
    details,
  };
}

export function composePilaAt2V30FilesFromApprovedSnapshots(
  input: PilaAt2V30ApprovedSnapshotScope,
): PilaAt2V30LocalFiles {
  return composePilaAt2V30LocalFiles(buildPilaAt2V30FileCandidates(input));
}
