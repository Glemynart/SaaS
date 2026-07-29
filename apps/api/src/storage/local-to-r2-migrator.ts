import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CloudflareR2StorageProvider } from './cloudflare-r2-storage.provider';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';

function resolveRoot(): string {
  return process.env.STORAGE_LOCAL_ROOT
    ? path.resolve(process.env.STORAGE_LOCAL_ROOT)
    : path.resolve(process.cwd(), '..', '..', 'uploads');
}

export interface StorageMigrationReport {
  copied: string[];
  existing: string[];
  differences: string[];
  errors: Array<{ key: string; message: string }>;
}

/** Migrador explícito, idempotente y sin sobrescrituras de LocalDisk a R2. */
export class LocalToR2Migrator {
  constructor(
    private readonly local: LocalDiskStorageProvider,
    private readonly r2: CloudflareR2StorageProvider,
    private readonly root = resolveRoot(),
  ) {}

  async migrate(): Promise<StorageMigrationReport> {
    const report: StorageMigrationReport = {
      copied: [],
      existing: [],
      differences: [],
      errors: [],
    };

    let keys: string[];
    try {
      keys = await this.listKeys(this.root);
    } catch (error) {
      report.errors.push({ key: '.', message: this.errorMessage(error) });
      return report;
    }

    for (const key of keys) {
      try {
        const localBody = await this.local.get(key);
        const stored = await this.r2.putIfAbsent({ key, body: localBody });
        if (!stored) {
          report.existing.push(key);
          const r2Body = await this.r2.get(key);
          if (!this.matches(localBody, r2Body)) report.differences.push(key);
          continue;
        }

        const r2Body = await this.r2.get(key);
        if (!this.matches(localBody, r2Body)) {
          report.differences.push(key);
          continue;
        }
        report.copied.push(key);
      } catch (error) {
        report.errors.push({ key, message: this.errorMessage(error) });
      }
    }

    return report;
  }

  private async listKeys(directory: string): Promise<string[]> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const keys: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        keys.push(...(await this.listKeys(fullPath)));
        continue;
      }
      if (!entry.isFile()) continue;

      const key = path.relative(this.root, fullPath).split(path.sep).join('/');
      if (!key || key.split('/').some((segment) => segment === '..')) {
        throw new Error(`Key local inválida durante migración: ${key}`);
      }
      keys.push(key);
    }

    return keys.sort();
  }

  private matches(source: Buffer, target: Buffer): boolean {
    return (
      source.length === target.length && this.hash(source) === this.hash(target)
    );
  }

  private hash(body: Buffer): string {
    return createHash('sha256').update(body).digest('hex');
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
