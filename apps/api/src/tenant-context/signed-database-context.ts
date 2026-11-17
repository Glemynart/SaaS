import { createHmac, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { SYSTEM_AUDIT_ACTORS, SystemAuditActorId } from '../audit/audit-actor';

export type DatabaseActorType = 'HUMAN' | 'SYSTEM';

export interface SignedDatabasePayload {
  readonly payload: string;
  readonly signature: Buffer;
  readonly keyId: string;
}

export interface AuditEventToSign {
  readonly id: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorType: DatabaseActorType;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly metadata: Record<string, unknown>;
}

export class SignedDatabaseContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignedDatabaseContextError';
  }
}

const SYSTEM_ACTOR_IDS = new Set<string>(Object.values(SYSTEM_AUDIT_ACTORS));

export function databaseActorType(actorId: string): DatabaseActorType {
  return SYSTEM_ACTOR_IDS.has(actorId) ? 'SYSTEM' : 'HUMAN';
}

export function signTenantDatabaseContext(
  tenantId: string,
  actorId: string,
  actorType: DatabaseActorType,
  transactionId: string,
): SignedDatabasePayload {
  const credentials = getDatabaseSigningCredentials();
  return signPayload(
    {
      version: 1,
      keyId: credentials.keyId,
      tenantId,
      actorId,
      actorType,
      transactionId,
    },
    credentials.key,
    credentials.keyId,
  );
}

export function signAuditEvent(event: AuditEventToSign): SignedDatabasePayload {
  const credentials = getDatabaseSigningCredentials();
  return signPayload(
    {
      version: 1,
      keyId: credentials.keyId,
      ...event,
    },
    credentials.key,
    credentials.keyId,
  );
}

export function signPayload(
  payloadValue: unknown,
  key: Buffer,
  keyId: string,
): SignedDatabasePayload {
  const payload = canonicalJson(payloadValue);
  const signature = createHmac('sha256', key).update(payload, 'utf8').digest();
  return { payload, signature, keyId };
}

export function getDatabaseSigningCredentials(): {
  key: Buffer;
  keyId: string;
} {
  const encodedKey = process.env.AUDIT_LOG_SIGNING_KEY;
  const keyId = process.env.AUDIT_LOG_SIGNING_KEY_ID ?? 'v1';
  if (!encodedKey || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(keyId)) {
    throw new Error(
      'La firma del contexto de base de datos no está configurada.',
    );
  }

  const key = Buffer.from(encodedKey, 'base64');
  if (key.length < 32 || key.toString('base64') !== encodedKey) {
    throw new Error('La firma del contexto de base de datos no es válida.');
  }

  return { key, keyId };
}

export async function installSignedTenantDatabaseContext(
  client: Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>,
  tenantId: string,
  actorId: string,
  actorType: DatabaseActorType = databaseActorType(actorId),
): Promise<void> {
  await installSignedTenantDatabaseContextInternal(
    client,
    tenantId,
    actorId,
    actorType,
    false,
  );
}

/**
 * System workers that intentionally process multiple tenants in one database
 * transaction may switch the signed scope, but only while retaining the same
 * allowlisted SYSTEM actor. Request-scoped HUMAN contexts cannot use this path.
 */
export async function installSignedSystemTenantDatabaseContext(
  client: Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>,
  tenantId: string,
  actorId: SystemAuditActorId,
): Promise<void> {
  if (!SYSTEM_ACTOR_IDS.has(actorId)) {
    throw new SignedDatabaseContextError(
      'La identidad de sistema no está autorizada para cambiar el contexto.',
    );
  }
  await installSignedTenantDatabaseContextInternal(
    client,
    tenantId,
    actorId,
    'SYSTEM',
    true,
  );
}

async function installSignedTenantDatabaseContextInternal(
  client: Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>,
  tenantId: string,
  actorId: string,
  actorType: DatabaseActorType,
  allowSameSystemActorTenantSwitch: boolean,
): Promise<void> {
  if ((actorType === 'SYSTEM') !== SYSTEM_ACTOR_IDS.has(actorId)) {
    throw new SignedDatabaseContextError(
      'El tipo de actor no coincide con la identidad de base de datos.',
    );
  }
  const [state] = await client.$queryRaw<
    {
      transactionId: string;
      tenantId: string | null;
      actorId: string | null;
      actorType: string | null;
      rawTenantId: string | null;
      rawPayload: string | null;
      rawSignature: string | null;
    }[]
  >`
    SELECT
      pg_catalog.pg_current_xact_id()::text AS "transactionId",
      audit_private.current_tenant_id() AS "tenantId",
      audit_private.current_actor_id() AS "actorId",
      audit_private.current_actor_type() AS "actorType",
      NULLIF(current_setting('app.current_tenant_id', true), '') AS "rawTenantId",
      NULLIF(current_setting('app.signed_tenant_context', true), '') AS "rawPayload",
      NULLIF(current_setting('app.signed_tenant_context_signature', true), '') AS "rawSignature"
  `;
  if (!state?.transactionId) {
    throw new SignedDatabaseContextError(
      'No fue posible establecer el contexto de base de datos.',
    );
  }

  if (state.tenantId) {
    const sameContext =
      state.tenantId === tenantId &&
      state.actorId === actorId &&
      state.actorType === actorType;
    if (sameContext) return;

    const authorizedSystemSwitch =
      allowSameSystemActorTenantSwitch &&
      actorType === 'SYSTEM' &&
      state.actorType === 'SYSTEM' &&
      state.actorId === actorId;
    if (!authorizedSystemSwitch) {
      throw new SignedDatabaseContextError(
        'El contexto firmado no coincide con el actor de la operación.',
      );
    }
  } else if (state.rawTenantId || state.rawPayload || state.rawSignature) {
    throw new SignedDatabaseContextError(
      'El contexto de base de datos existente no es válido.',
    );
  }

  const signed = signTenantDatabaseContext(
    tenantId,
    actorId,
    actorType,
    state.transactionId,
  );
  await client.$executeRaw`
    SELECT
      set_config('app.current_tenant_id', ${tenantId}, true),
      set_config('app.signed_tenant_context', ${signed.payload}, true),
      set_config(
        'app.signed_tenant_context_signature',
        ${signed.signature.toString('hex')},
        true
      )
  `;
}

export function createAuditEventId(): string {
  return randomUUID();
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('El evento de auditoría contiene un número no válido.');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (typeof value === 'object') {
    const prototype = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(
        'El evento de auditoría contiene datos no serializables.',
      );
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => {
        if (record[key] === undefined) {
          throw new Error(
            'El evento de auditoría contiene datos no serializables.',
          );
        }
        return `${JSON.stringify(key)}:${canonicalJson(record[key])}`;
      })
      .join(',')}}`;
  }
  throw new Error('El evento de auditoría contiene datos no serializables.');
}
