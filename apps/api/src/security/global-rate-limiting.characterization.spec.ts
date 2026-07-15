import {
  Controller,
  type DynamicModule,
  Get,
  INestApplication,
  Ip,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  getOptionsToken,
  ThrottlerModule,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { AuthController } from '../auth/auth.controller';

const THROTTLER_LIMIT = 'THROTTLER:LIMIT';
const THROTTLER_TTL = 'THROTTLER:TTL';
const THROTTLER_SKIP = 'THROTTLER:SKIP';

const AUTH_THROTTLERS = [
  { name: 'login', ttl: 60_000, limit: 5 },
  { name: 'register', ttl: 60_000, limit: 3 },
  { name: 'refresh', ttl: 60_000, limit: 10 },
  { name: 'forgotPassword', ttl: 3_600_000, limit: 3 },
  { name: 'resetPassword', ttl: 900_000, limit: 5 },
] as const;

type AuthThrottleMethod =
  | 'register'
  | 'login'
  | 'refresh'
  | 'forgotPassword'
  | 'resetPassword';

function getAuthHandler(methodName: AuthThrottleMethod): object {
  const handler = Object.getOwnPropertyDescriptor(
    AuthController.prototype,
    methodName,
  )?.value as unknown;
  if (typeof handler !== 'function') {
    throw new Error(`Auth handler not found: ${methodName}`);
  }
  return handler;
}

@Controller('client-ip-characterization')
class ClientIpCharacterizationController {
  @Get()
  identify(@Ip() ip: string) {
    return { ip };
  }
}

describe('Global Rate Limiting operational characterization', () => {
  let ipApplication: INestApplication<App>;

  beforeAll(async () => {
    const ipModule = await Test.createTestingModule({
      controllers: [ClientIpCharacterizationController],
    }).compile();
    ipApplication = ipModule.createNestApplication<INestApplication<App>>();
    await ipApplication.init();
  });

  afterAll(async () => {
    await ipApplication.close();
  });

  it('keeps the five existing Auth throttlers unchanged', () => {
    const imports = (Reflect.getMetadata('imports', AppModule) ??
      []) as unknown[];
    const throttlerModule = imports.find(
      (module): module is DynamicModule =>
        typeof module === 'object' &&
        module !== null &&
        'module' in module &&
        module.module === ThrottlerModule,
    );
    const optionsProvider = throttlerModule?.providers?.find(
      (provider) =>
        typeof provider === 'object' &&
        provider !== null &&
        'provide' in provider &&
        provider.provide === getOptionsToken() &&
        'useValue' in provider,
    ) as { useValue?: ThrottlerModuleOptions } | undefined;
    const options = optionsProvider?.useValue;

    expect(options).toEqual(AUTH_THROTTLERS);
    expect(Array.isArray(options)).toBe(true);
    expect(
      (options as Array<{ name?: string }>).some(
        ({ name }) => name === undefined || name === 'default',
      ),
    ).toBe(false);
  });

  it.each([
    ['register', 'register', 3, 60_000],
    ['login', 'login', 5, 60_000],
    ['refresh', 'refresh', 10, 60_000],
    ['forgotPassword', 'forgotPassword', 3, 3_600_000],
    ['resetPassword', 'resetPassword', 5, 900_000],
  ] as const)(
    'preserves the %s endpoint metadata',
    (methodName, throttlerName, limit, ttl) => {
      const handler = getAuthHandler(methodName);

      expect(
        Reflect.getMetadata(`${THROTTLER_LIMIT}${throttlerName}`, handler),
      ).toBe(limit);
      expect(
        Reflect.getMetadata(`${THROTTLER_TTL}${throttlerName}`, handler),
      ).toBe(ttl);
    },
  );

  it('records the current Auth bucket coexistence without changing it', () => {
    for (const methodName of ['register', 'login', 'refresh'] as const) {
      const handler = getAuthHandler(methodName);
      for (const { name } of AUTH_THROTTLERS) {
        expect(Reflect.getMetadata(`${THROTTLER_SKIP}${name}`, handler)).toBe(
          undefined,
        );
      }
    }

    const forgotPassword = getAuthHandler('forgotPassword');
    expect(Reflect.getMetadata(`${THROTTLER_SKIP}login`, forgotPassword)).toBe(
      true,
    );
    expect(
      Reflect.getMetadata(`${THROTTLER_SKIP}register`, forgotPassword),
    ).toBe(true);
    expect(
      Reflect.getMetadata(`${THROTTLER_SKIP}refresh`, forgotPassword),
    ).toBe(true);
    expect(
      Reflect.getMetadata(`${THROTTLER_SKIP}resetPassword`, forgotPassword),
    ).toBe(true);

    const resetPassword = getAuthHandler('resetPassword');
    expect(Reflect.getMetadata(`${THROTTLER_SKIP}login`, resetPassword)).toBe(
      true,
    );
    expect(
      Reflect.getMetadata(`${THROTTLER_SKIP}register`, resetPassword),
    ).toBe(true);
    expect(Reflect.getMetadata(`${THROTTLER_SKIP}refresh`, resetPassword)).toBe(
      true,
    );
    expect(
      Reflect.getMetadata(`${THROTTLER_SKIP}forgotPassword`, resetPassword),
    ).toBe(true);
  });

  it('confirms that no global guard is registered in AppModule', () => {
    const providers = (Reflect.getMetadata('providers', AppModule) ??
      []) as Array<unknown>;

    expect(
      providers.some(
        (provider) =>
          typeof provider === 'object' &&
          provider !== null &&
          'provide' in provider &&
          provider.provide === APP_GUARD,
      ),
    ).toBe(false);
  });

  it('confirms that the current Express default ignores forwarded IP headers', async () => {
    const express = ipApplication.getHttpAdapter().getInstance() as {
      get(setting: string): unknown;
    };
    expect(express.get('trust proxy')).toBe(false);

    const direct = await request(ipApplication.getHttpServer())
      .get('/client-ip-characterization')
      .expect(200);
    const forwarded = await request(ipApplication.getHttpServer())
      .get('/client-ip-characterization')
      .set('X-Forwarded-For', '203.0.113.10')
      .expect(200);

    const directIp = (direct.body as { ip: string }).ip;
    const forwardedIp = (forwarded.body as { ip: string }).ip;
    expect(forwardedIp).toBe(directIp);
    expect(forwardedIp).not.toBe('203.0.113.10');
  });
});
