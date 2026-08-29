import { ConfigModule } from '@nestjs/config';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { generateKeyPairSync } from 'node:crypto';
import type { Server } from 'node:http';
import { Plan } from '@prisma/client';
import request from 'supertest';
import configuration from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformAdminModule } from '../platform-admin.module';
import { PLATFORM_S2S_SCOPE } from '../guards/platform-s2s.guard';
import { PLATFORM_TENANT_SELECT } from './platform-tenants.service';

describe('PlatformTenantsController HTTP', () => {
  const issuer = 'https://pos.example.test';
  const audience = 'dusema-admin-api';
  const kid = 'pos-key-2026-01';
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const privateKeyPem = privateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString();
  const publicKeyPem = publicKey
    .export({ type: 'spki', format: 'pem' })
    .toString();
  const { privateKey: differentPrivateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const differentPrivateKeyPem = differentPrivateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString();
  const originalPlatformConfig = {
    issuer: process.env.PLATFORM_S2S_ISSUER,
    audience: process.env.PLATFORM_S2S_AUDIENCE,
    kid: process.env.PLATFORM_S2S_KID,
    publicKey: process.env.PLATFORM_S2S_PUBLIC_KEY,
  };
  const findUnique = jest.fn();
  const prisma = {
    tenant: { findUnique },
  } as unknown as PrismaService;
  let app: INestApplication;
  let server: Server;
  let jwt: JwtService;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeAll(async () => {
    process.env.PLATFORM_S2S_ISSUER = issuer;
    process.env.PLATFORM_S2S_AUDIENCE = audience;
    process.env.PLATFORM_S2S_KID = kid;
    process.env.PLATFORM_S2S_PUBLIC_KEY = publicKeyPem;

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        PlatformAdminModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
    jwt = moduleRef.get(JwtService);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  beforeEach(() => {
    findUnique.mockReset();
    logSpy.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
    restoreEnvironmentVariable(
      'PLATFORM_S2S_ISSUER',
      originalPlatformConfig.issuer,
    );
    restoreEnvironmentVariable(
      'PLATFORM_S2S_AUDIENCE',
      originalPlatformConfig.audience,
    );
    restoreEnvironmentVariable('PLATFORM_S2S_KID', originalPlatformConfig.kid);
    restoreEnvironmentVariable(
      'PLATFORM_S2S_PUBLIC_KEY',
      originalPlatformConfig.publicKey,
    );
  });

  it('permite un JWT S2S válido con el scope requerido', async () => {
    findUnique.mockResolvedValue(tenantRowWithSensitiveExtras());

    const response = await request(server)
      .get('/platform/admin/v1/tenants/tenant-a')
      .set('Authorization', `Bearer ${await tokenFor()}`)
      .expect(200);

    expect(response.body).toEqual({
      id: 'tenant-a',
      nombre: 'Colegio Demo',
      razonSocial: 'Colegio Demo SAS',
      nit: '900123456',
      activo: true,
      plan: Plan.STARTER,
      createdAt: '2026-08-20T10:00:00.000Z',
      updatedAt: '2026-08-21T10:00:00.000Z',
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-a' },
      select: PLATFORM_TENANT_SELECT,
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"correlationId":"corr-001"'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"result":"SUCCESS"'),
    );
  });

  it.each([
    [
      'JWT inválido',
      () => tokenFor({}, { privateKey: differentPrivateKeyPem }),
    ],
    [
      'issuer incorrecto',
      () => tokenFor({}, { issuer: 'https://other.example.test' }),
    ],
    ['audience incorrecta', () => tokenFor({}, { audience: 'other-api' })],
    ['token expirado', () => tokenFor({}, { expiresIn: -1 })],
    ['scope incorrecto', () => tokenFor({ scope: 'dusema:tenant:write' })],
    ['kid desconocido', () => tokenFor({}, { keyid: 'unknown-key' })],
  ])('rechaza %s', async (_case, createToken) => {
    await request(server)
      .get('/platform/admin/v1/tenants/tenant-a')
      .set('Authorization', `Bearer ${await createToken()}`)
      .expect(401);

    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each([
    [
      'HS256',
      () => tokenFor({}, { algorithm: 'HS256', secret: 'hs-test-secret' }),
    ],
    ['RS384', () => tokenFor({}, { algorithm: 'RS384' })],
    ['none', () => unsignedToken()],
  ])('rechaza el algoritmo alternativo %s', async (_algorithm, createToken) => {
    await request(server)
      .get('/platform/admin/v1/tenants/tenant-a')
      .set('Authorization', `Bearer ${await createToken()}`)
      .expect(401);

    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['sub ausente', { sub: undefined }],
    ['actorUid inválido', { actorUid: '' }],
    ['empresaPosId ausente', { empresaPosId: undefined }],
    ['correlationId inválido', { correlationId: 42 }],
    ['jti ausente', { jti: undefined }],
    ['iat inválido', { iat: -1 }, { noExpiration: true }],
    ['exp ausente', {}, { noExpiration: true }],
    ['aud inválido', { aud: [] }, { noAudience: true }],
  ])(
    'rechaza el claim obligatorio %s',
    async (_claim, payloadOverrides, options: TokenOptions = {}) => {
      await request(server)
        .get('/platform/admin/v1/tenants/tenant-a')
        .set(
          'Authorization',
          `Bearer ${await tokenFor(payloadOverrides, options)}`,
        )
        .expect(401);

      expect(findUnique).not.toHaveBeenCalled();
    },
  );

  it('no registra token, Authorization ni secretos cuando rechaza el JWT', async () => {
    const sensitiveSecret = 's2s-test-secret-not-log';
    const token = await tokenFor(
      { correlationId: sensitiveSecret },
      { privateKey: differentPrivateKeyPem },
    );
    const authorizationHeader = `Bearer ${token}`;

    await request(server)
      .get('/platform/admin/v1/tenants/tenant-a')
      .set('Authorization', authorizationHeader)
      .expect(401);

    const logCalls: unknown[][] = [
      ...(logSpy.mock.calls as unknown[][]),
      ...(warnSpy.mock.calls as unknown[][]),
      ...(errorSpy.mock.calls as unknown[][]),
    ];
    const logText = logCalls.flat().map(String).join('\n');

    expect(logText).not.toContain(token);
    expect(logText).not.toContain('Authorization');
    expect(logText).not.toContain(authorizationHeader);
    expect(logText).not.toContain(privateKeyPem);
    expect(logText).not.toContain(differentPrivateKeyPem);
    expect(logText).not.toContain(publicKeyPem);
    expect(logText).not.toContain(sensitiveSecret);
  });

  it('rechaza la ausencia de token', async () => {
    await request(server)
      .get('/platform/admin/v1/tenants/tenant-a')
      .expect(401);

    expect(findUnique).not.toHaveBeenCalled();
  });

  it('devuelve 404 cuando el Tenant no existe', async () => {
    findUnique.mockResolvedValue(null);

    await request(server)
      .get('/platform/admin/v1/tenants/tenant-missing')
      .set('Authorization', `Bearer ${await tokenFor()}`)
      .expect(404);

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-missing' },
      select: PLATFORM_TENANT_SELECT,
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"result":"NOT_FOUND"'),
    );
  });

  it('no filtra campos adicionales del registro Prisma', async () => {
    findUnique.mockResolvedValue(tenantRowWithSensitiveExtras());

    const response = await request(server)
      .get('/platform/admin/v1/tenants/tenant-a')
      .set('Authorization', `Bearer ${await tokenFor()}`)
      .expect(200);

    const body = response.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'activo',
      'createdAt',
      'id',
      'nit',
      'nombre',
      'plan',
      'razonSocial',
      'updatedAt',
    ]);
    expect(body).not.toHaveProperty('users');
    expect(body).not.toHaveProperty('feTecnicoKey');
    expect(body).not.toHaveProperty('direccion');
  });

  async function tokenFor(
    payloadOverrides: Record<string, unknown> = {},
    options: TokenOptions = {},
  ): Promise<string> {
    const payload = {
      sub: 'pos-service',
      actorUid: 'operator-001',
      empresaPosId: 'pos-company-001',
      correlationId: 'corr-001',
      jti: 'jti-001',
      scope: PLATFORM_S2S_SCOPE,
      ...payloadOverrides,
    };
    const signOptions = {
      algorithm: options.algorithm ?? 'RS256',
      issuer: options.issuer ?? issuer,
      ...(options.noAudience ? {} : { audience: options.audience ?? audience }),
      ...(options.noExpiration
        ? {}
        : { expiresIn: options.expiresIn ?? '15m' }),
      ...(options.noTimestamp ? { noTimestamp: true } : {}),
      keyid: options.keyid ?? kid,
    };

    if (options.secret !== undefined) {
      return jwt.signAsync(payload, { ...signOptions, secret: options.secret });
    }

    return jwt.signAsync(payload, {
      ...signOptions,
      privateKey: options.privateKey ?? privateKeyPem,
    });
  }

  function unsignedToken(): string {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'none', typ: 'JWT', kid };
    const payload = {
      iss: issuer,
      aud: audience,
      sub: 'pos-service',
      actorUid: 'operator-001',
      empresaPosId: 'pos-company-001',
      correlationId: 'corr-001',
      jti: 'jti-001',
      scope: PLATFORM_S2S_SCOPE,
      iat: now,
      exp: now + 900,
    };

    return `${base64Url(header)}.${base64Url(payload)}.`;
  }

  function tenantRowWithSensitiveExtras() {
    return {
      id: 'tenant-a',
      nombre: 'Colegio Demo',
      razonSocial: 'Colegio Demo SAS',
      nit: '900123456',
      activo: true,
      plan: Plan.STARTER,
      createdAt: new Date('2026-08-20T10:00:00.000Z'),
      updatedAt: new Date('2026-08-21T10:00:00.000Z'),
      direccion: 'No debe salir',
      users: [{ id: 'user-secret' }],
      feTecnicoKey: 'secret-key',
    };
  }
});

type TokenOptions = {
  privateKey?: string;
  secret?: string;
  issuer?: string;
  audience?: string;
  algorithm?: 'RS256' | 'RS384' | 'HS256';
  expiresIn?: '15m' | number;
  noExpiration?: boolean;
  noTimestamp?: boolean;
  noAudience?: boolean;
  keyid?: string;
};

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
