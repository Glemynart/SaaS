import { CloudflareR2StorageProvider } from './cloudflare-r2-storage.provider';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { LocalToR2Migrator } from './local-to-r2-migrator';

async function main(): Promise<void> {
  const r2 = new CloudflareR2StorageProvider();
  r2.validateConfiguration();

  const report = await new LocalToR2Migrator(
    new LocalDiskStorageProvider(),
    r2,
  ).migrate();
  console.log(JSON.stringify(report, null, 2));

  if (report.errors.length > 0 || report.differences.length > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
