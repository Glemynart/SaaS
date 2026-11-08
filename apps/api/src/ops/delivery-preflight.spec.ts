import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  DeliveryPreflightError,
  R2PreflightCommand,
  SmtpPreflightTransport,
  SmtpPreflightTransportOptions,
  verifyR2WriteAccess,
  verifySmtpAccess,
} from './delivery-preflight';

describe('delivery preflight', () => {
  describe('verifyR2WriteAccess', () => {
    it('requires exact bucket confirmation before making any request', async () => {
      const send = jest.fn<Promise<unknown>, [R2PreflightCommand]>();

      await expect(
        verifyR2WriteAccess(r2Environment(), 'another-bucket', send),
      ).rejects.toMatchObject({ code: 'R2_CONFIGURATION_INVALID' });
      expect(send).not.toHaveBeenCalled();
    });

    it('rejects a non-R2 HTTPS endpoint before exposing credentials', async () => {
      const environment = r2Environment();
      environment.R2_ENDPOINT = 'https://attacker.example.invalid';
      const send = jest.fn<Promise<unknown>, [R2PreflightCommand]>();

      await expect(
        verifyR2WriteAccess(environment, 'preflight-test-bucket', send),
      ).rejects.toMatchObject({ code: 'R2_CONFIGURATION_INVALID' });
      expect(send).not.toHaveBeenCalled();
    });

    it.each([
      'https://account.r2.cloudflarestorage.com:8443',
      'https://account.r2.cloudflarestorage.com/?unexpected=1',
      'https://account.r2.cloudflarestorage.com/#unexpected',
    ])(
      'rejects R2 endpoints with unsupported URL parts before sending credentials: %s',
      async (endpoint) => {
        const environment = r2Environment();
        environment.R2_ENDPOINT = endpoint;
        const send = jest.fn<Promise<unknown>, [R2PreflightCommand]>();

        await expect(
          verifyR2WriteAccess(environment, 'preflight-test-bucket', send),
        ).rejects.toMatchObject({ code: 'R2_CONFIGURATION_INVALID' });
        expect(send).not.toHaveBeenCalled();
      },
    );

    it('writes, reads, hashes, deletes and confirms absence of a synthetic object', async () => {
      let expected = Buffer.alloc(0);
      const send = jest.fn<Promise<unknown>, [R2PreflightCommand]>();
      send.mockImplementation((command) => {
        if (command instanceof PutObjectCommand) {
          expected = Buffer.from(command.input.Body as Uint8Array);
          return Promise.resolve({});
        }
        if (command instanceof GetObjectCommand) {
          return Promise.resolve({
            Body: {
              transformToByteArray: () =>
                Promise.resolve(Uint8Array.from(expected)),
            },
          });
        }
        if (command instanceof HeadObjectCommand) {
          if (
            send.mock.calls.filter(
              ([item]) => item instanceof DeleteObjectCommand,
            ).length
          ) {
            return Promise.reject(
              Object.assign(new Error('missing'), { name: 'NotFound' }),
            );
          }
          return Promise.resolve({ ContentLength: expected.length });
        }
        return Promise.resolve({});
      });

      const result = await verifyR2WriteAccess(
        r2Environment(),
        'preflight-test-bucket',
        send,
      );

      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.key).toMatch(/^__health__\/preflight\/[0-9a-f-]+\.bin$/);
      expect(
        send.mock.calls.map(([command]) => command.constructor.name),
      ).toEqual([
        'PutObjectCommand',
        'GetObjectCommand',
        'HeadObjectCommand',
        'DeleteObjectCommand',
        'HeadObjectCommand',
      ]);
      expect(send.mock.calls[0]?.[0]).toMatchObject({
        input: {
          Bucket: 'preflight-test-bucket',
          ContentType: 'application/octet-stream',
        },
      });
    });

    it('attempts cleanup after a failed round-trip', async () => {
      const send = jest.fn<Promise<unknown>, [R2PreflightCommand]>();
      send.mockImplementation((command) => {
        if (command instanceof GetObjectCommand) {
          return Promise.resolve({
            Body: {
              transformToByteArray: () => Promise.resolve(Uint8Array.from([9])),
            },
          });
        }
        if (
          command instanceof HeadObjectCommand &&
          send.mock.calls.some(([item]) => item instanceof DeleteObjectCommand)
        ) {
          return Promise.reject(
            Object.assign(new Error('missing'), { name: 'NoSuchKey' }),
          );
        }
        if (command instanceof HeadObjectCommand) {
          return Promise.resolve({ ContentLength: 32 });
        }
        return Promise.resolve({});
      });

      await expect(
        verifyR2WriteAccess(r2Environment(), 'preflight-test-bucket', send),
      ).rejects.toMatchObject({ code: 'R2_HASH_MISMATCH' });
      expect(
        send.mock.calls.some(([item]) => item instanceof DeleteObjectCommand),
      ).toBe(true);
    });

    it('classifies a missing read as a read failure and still removes the key', async () => {
      const send = jest.fn<Promise<unknown>, [R2PreflightCommand]>();
      send.mockImplementation((command) => {
        if (command instanceof GetObjectCommand) {
          return Promise.reject(
            Object.assign(new Error('missing'), {
              name: 'NoSuchKey',
              $metadata: { httpStatusCode: 404 },
            }),
          );
        }
        if (
          command instanceof HeadObjectCommand &&
          send.mock.calls.some(([item]) => item instanceof DeleteObjectCommand)
        ) {
          return Promise.reject(
            Object.assign(new Error('missing'), { name: 'NotFound' }),
          );
        }
        return Promise.resolve({ ContentLength: 32 });
      });

      await expect(
        verifyR2WriteAccess(r2Environment(), 'preflight-test-bucket', send),
      ).rejects.toMatchObject({ code: 'R2_READ_FAILED' });
      expect(
        send.mock.calls.some(([item]) => item instanceof DeleteObjectCommand),
      ).toBe(true);
    });

    it('reports the key if cleanup cannot be confirmed', async () => {
      const send = jest.fn<Promise<unknown>, [R2PreflightCommand]>();
      send.mockImplementation((command) => {
        if (command instanceof GetObjectCommand) {
          return Promise.resolve({
            Body: {
              transformToByteArray: () =>
                Promise.resolve(Uint8Array.from(Buffer.alloc(32))),
            },
          });
        }
        if (command instanceof HeadObjectCommand) {
          return Promise.resolve({ ContentLength: 32 });
        }
        if (command instanceof DeleteObjectCommand) {
          return Promise.reject(
            Object.assign(new Error('denied'), { name: 'AccessDenied' }),
          );
        }
        return Promise.resolve({});
      });

      let failure: DeliveryPreflightError | undefined;
      try {
        await verifyR2WriteAccess(
          r2Environment(),
          'preflight-test-bucket',
          send,
        );
      } catch (error) {
        if (error instanceof DeliveryPreflightError) failure = error;
        else throw error;
      }
      expect(failure?.code).toBe('R2_CLEANUP_FAILED');
      expect(failure?.cleanupKey).toMatch(/^__health__\/preflight\//);
    });
  });

  describe('verifySmtpAccess', () => {
    it('verifies TLS SMTP auth without sending and always closes the transport', async () => {
      const verify = jest.fn<Promise<boolean>, []>().mockResolvedValue(true);
      const close = jest.fn<void, []>();
      const factory = jest.fn<
        SmtpPreflightTransport,
        [SmtpPreflightTransportOptions]
      >(() => ({ verify, close }));

      await verifySmtpAccess(smtpEnvironment(), factory);

      expect(factory).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.email.us-ashburn-1.oci.oraclecloud.com',
          secure: false,
          requireTLS: true,
          tls: { minVersion: 'TLSv1.2' },
          auth: { user: 'smtp-user', pass: 'smtp-password' },
        }),
      );
      expect(verify).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('rejects plaintext configuration before connecting', async () => {
      const factory = jest.fn<
        SmtpPreflightTransport,
        [SmtpPreflightTransportOptions]
      >();
      const environment = smtpEnvironment();
      environment.EMAIL_SMTP_REQUIRE_TLS = 'false';

      await expect(
        verifySmtpAccess(environment, factory),
      ).rejects.toMatchObject({ code: 'SMTP_CONFIGURATION_INVALID' });
      expect(factory).not.toHaveBeenCalled();
    });

    it('does not send SMTP credentials to a non-OCI host', async () => {
      const factory = jest.fn<
        SmtpPreflightTransport,
        [SmtpPreflightTransportOptions]
      >();
      const environment = smtpEnvironment();
      environment.EMAIL_SMTP_HOST = 'smtp.attacker.example.invalid';

      await expect(
        verifySmtpAccess(environment, factory),
      ).rejects.toMatchObject({ code: 'SMTP_CONFIGURATION_INVALID' });
      expect(factory).not.toHaveBeenCalled();
    });

    it('classifies auth errors without surfacing server messages', async () => {
      const verify = jest.fn<Promise<boolean>, []>().mockRejectedValue(
        Object.assign(new Error('private server response'), {
          code: 'EAUTH',
        }),
      );
      const close = jest.fn<void, []>();
      const factory = jest.fn<
        SmtpPreflightTransport,
        [SmtpPreflightTransportOptions]
      >(() => ({ verify, close }));

      await expect(
        verifySmtpAccess(smtpEnvironment(), factory),
      ).rejects.toMatchObject({ code: 'SMTP_AUTH_REJECTED' });
      expect(close).toHaveBeenCalledTimes(1);
    });
  });
});

function r2Environment(): NodeJS.ProcessEnv {
  return {
    R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
    R2_BUCKET: 'preflight-test-bucket',
  };
}

function smtpEnvironment(): NodeJS.ProcessEnv {
  return {
    EMAIL_SMTP_HOST: 'smtp.email.us-ashburn-1.oci.oraclecloud.com',
    EMAIL_SMTP_PORT: '587',
    EMAIL_SMTP_USER: 'smtp-user',
    EMAIL_SMTP_PASSWORD: 'smtp-password',
    EMAIL_SMTP_SECURE: 'false',
    EMAIL_SMTP_REQUIRE_TLS: 'true',
    EMAIL_FROM: 'noreply@example.invalid',
  };
}
