import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuditService } from '../audit/audit.service';
import { TenantsService } from '../tenants/tenants.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordResetService } from './password-reset.service';
import { UserInvitationsService } from '../users/user-invitations.service';

describe('AuthController reset token validation', () => {
  let app: INestApplication<App>;
  const validateResetToken = jest.fn().mockResolvedValue({ valid: false });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { name: 'validateResetToken', ttl: 900_000, limit: 50 },
        ]),
      ],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: TenantsService, useValue: {} },
        {
          provide: PasswordResetService,
          useValue: { validateResetToken },
        },
        { provide: AuditService, useValue: {} },
        { provide: UserInvitationsService, useValue: {} },
      ],
    }).compile();

    app = module.createNestApplication<INestApplication<App>>();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    validateResetToken.mockClear();
    validateResetToken.mockResolvedValue({ valid: false });
  });

  it('returns an opaque invalid result for a malformed token', async () => {
    await request(app.getHttpServer())
      .post('/auth/validate-reset-token')
      .send({ token: 'malformed' })
      .expect(200, { valid: false });

    expect(validateResetToken).toHaveBeenCalledWith('malformed');
  });

  it('treats a missing token as invalid instead of exposing validation details', async () => {
    await request(app.getHttpServer())
      .post('/auth/validate-reset-token')
      .send({})
      .expect(200, { valid: false });

    expect(validateResetToken).toHaveBeenCalledWith(undefined);
  });
});
