import {
  createR2PreflightSender,
  DeliveryPreflightError,
  verifyR2WriteAccess,
  verifySmtpAccess,
} from '../src/ops/delivery-preflight';

type Arguments = {
  r2Write: boolean;
  confirmedBucket?: string;
  smtpVerify: boolean;
  smtpConnectionConfirmed: boolean;
};

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  if (!args.r2Write && !args.smtpVerify) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  let failed = false;
  if (args.r2Write) {
    const r2 = createR2PreflightSender();
    try {
      const result = await verifyR2WriteAccess(
        process.env,
        args.confirmedBucket,
        r2.send,
      );
      console.log(
        `R2 round-trip, SHA-256 and cleanup: PASS (${result.sha256})`,
      );
    } catch (error) {
      failed = true;
      reportFailure(error);
    } finally {
      r2.close();
    }
  }

  if (args.smtpVerify) {
    if (!args.smtpConnectionConfirmed) {
      failed = true;
      console.error(
        'SMTP verify skipped: add --confirm-smtp-connect to authorize one connection/authentication attempt.',
      );
    } else {
      try {
        await verifySmtpAccess(process.env);
        console.log(
          'SMTP TLS connection and authentication: PASS (no email sent)',
        );
      } catch (error) {
        failed = true;
        reportFailure(error);
      }
    }
  }

  if (failed) process.exitCode = 1;
}

function parseArguments(values: string[]): Arguments {
  const result: Arguments = {
    r2Write: false,
    smtpVerify: false,
    smtpConnectionConfirmed: false,
  };

  for (const value of values) {
    if (value === '--r2-write') result.r2Write = true;
    else if (value === '--smtp-verify') result.smtpVerify = true;
    else if (value === '--confirm-smtp-connect') {
      result.smtpConnectionConfirmed = true;
    } else if (value.startsWith('--confirm-r2-bucket=')) {
      result.confirmedBucket = value.slice('--confirm-r2-bucket='.length);
    } else {
      throw new Error('INVALID_ARGUMENTS');
    }
  }

  if (result.r2Write && !result.confirmedBucket) {
    throw new Error('R2_BUCKET_CONFIRMATION_REQUIRED');
  }
  if (!result.r2Write && result.confirmedBucket) {
    throw new Error('R2_FLAG_REQUIRED');
  }
  return result;
}

function reportFailure(error: unknown): void {
  if (error instanceof DeliveryPreflightError) {
    console.error(`Preflight failed: ${error.code}`);
    if (error.cleanupKey) {
      console.error(
        `Manual cleanup may be required for the synthetic object key: ${error.cleanupKey}`,
      );
    }
    return;
  }
  console.error('Preflight failed: PREFLIGHT_FAILED_UNEXPECTED');
}

function printUsage(): void {
  console.log(`Safe delivery preflight (does not send email or access tenant data)

R2 writes one random 32-byte object and attempts to delete it. Both flags are required:
  pnpm --filter @saas/api ops:delivery-preflight -- --r2-write --confirm-r2-bucket=REPLACE_WITH_EXACT_PRIVATE_STAGING_BUCKET

SMTP makes one TLS-protected connection/authentication attempt and sends no email:
  pnpm --filter @saas/api ops:delivery-preflight -- --smtp-verify --confirm-smtp-connect

Environment variables must already be supplied by the operator. This command does not load or print .env files.`);
}

main().catch((error: unknown) => {
  const code = error instanceof Error ? error.message : '';
  if (
    code === 'INVALID_ARGUMENTS' ||
    code === 'R2_BUCKET_CONFIRMATION_REQUIRED' ||
    code === 'R2_FLAG_REQUIRED'
  ) {
    printUsage();
  } else {
    reportFailure(error);
  }
  process.exitCode = 2;
});
