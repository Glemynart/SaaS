import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './prisma/prisma.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { DocumentTemplatesModule } from './document-templates/document-templates.module';
import { GeneratedDocumentsModule } from './generated-documents/generated-documents.module';
import { TenantBrandingModule } from './tenant-branding/tenant-branding.module';
import { ExpedienteDocsModule } from './expediente-docs/expediente-docs.module';
import { AlertsModule } from './alerts/alerts.module';
import { PayrollModule } from './payroll/payroll.module';
import { BillingModule } from './billing/billing.module';
import { AuditModule } from './audit/audit.module';
import { DaneModule } from './dane/dane.module';
import { SedesModule } from './sedes/sedes.module';
import { EmployeeImportModule } from './employee-import/employee-import.module';
import { ContractsModule } from './contracts/contracts.module';
import { LotesModule } from './lotes/lotes.module';
import { EmailModule } from './email/email.module';
import { StorageModule } from './storage/storage.module';
import { PdfRenderModule } from './pdf-render/pdf-render.module';
import { AccountingModule } from './accounting/accounting.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { TenantContextModule } from './tenant-context/tenant-context.module';
import { TenantPrismaModule } from './tenant-prisma/tenant-prisma.module';
import { ContractualProfilesModule } from './contractual-profiles/contractual-profiles.module';
import { LaborRelationshipsModule } from './labor-relationships/labor-relationships.module';
import { DocumentProfileConfigurationsModule } from './document-profile-configurations/document-profile-configurations.module';
import { DocumentResolutionModule } from './document-resolution/document-resolution.module';
import { BatchDocumentGenerationModule } from './batch-document-generation/batch-document-generation.module';
import { HealthModule } from './health/health.module';
import { HttpObservabilityMiddleware } from './observability/http-observability.middleware';

// The browser smoke suite creates four tenants from one local IP. The guard
// evaluates every global bucket on each auth route, so test-only headroom for
// registration and login avoids cross-bucket interference without changing
// production limits.
const REGISTER_RATE_LIMIT = process.env.NODE_ENV === 'test' ? 50 : 3;
const LOGIN_RATE_LIMIT = process.env.NODE_ENV === 'test' ? 50 : 5;
const FORGOT_PASSWORD_RATE_LIMIT = process.env.NODE_ENV === 'test' ? 10 : 3;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppConfigModule,
    PrismaModule,
    TenantsModule,
    UsersModule,
    AuthModule,
    EmployeesModule,
    DocumentTemplatesModule,
    GeneratedDocumentsModule,
    TenantBrandingModule,
    ExpedienteDocsModule,
    AlertsModule,
    PayrollModule,
    BillingModule,
    AuditModule,
    DaneModule,
    SedesModule,
    EmployeeImportModule,
    // Register the static /contracts/lotes routes before /contracts/:id.
    LotesModule,
    ContractsModule,
    EmailModule,
    StorageModule,
    PdfRenderModule,
    AccountingModule,
    TenantContextModule,
    TenantPrismaModule,
    ContractualProfilesModule,
    LaborRelationshipsModule,
    DocumentProfileConfigurationsModule,
    DocumentResolutionModule,
    BatchDocumentGenerationModule,
    HealthModule,
    ThrottlerModule.forRoot([
      {
        name: 'login',
        ttl: 60000,
        limit: LOGIN_RATE_LIMIT,
      },
      {
        name: 'register',
        ttl: 60000,
        limit: REGISTER_RATE_LIMIT,
      },
      {
        name: 'refresh',
        ttl: 60000,
        limit: process.env.NODE_ENV === 'test' ? 50 : 10,
      },
      {
        name: 'forgotPassword',
        ttl: 3600000,
        limit:
          process.env.NODE_ENV === 'test' ? 50 : FORGOT_PASSWORD_RATE_LIMIT,
      },
      {
        name: 'resetPassword',
        ttl: 900000,
        limit: process.env.NODE_ENV === 'test' ? 50 : 5,
      },
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpObservabilityMiddleware).forRoutes('*');
  }
}
