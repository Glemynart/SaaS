import { Module } from '@nestjs/common';
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
import { EmployeeFilesModule } from './employee-files/employee-files.module';
import { AlertsModule } from './alerts/alerts.module';
import { PayrollModule } from './payroll/payroll.module';
import { BillingModule } from './billing/billing.module';
import { AuditModule } from './audit/audit.module';
import { DaneModule } from './dane/dane.module';
import { SedesModule } from './sedes/sedes.module';
import { ThrottlerModule } from '@nestjs/throttler';

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
    EmployeeFilesModule,
    AlertsModule,
    PayrollModule,
    BillingModule,
    AuditModule,
    DaneModule,
    SedesModule,
    ThrottlerModule.forRoot([
      {
        name: 'login',
        ttl: 60000,
        limit: 5,
      },
      {
        name: 'register',
        ttl: 60000,
        limit: 3,
      },
      {
        name: 'refresh',
        ttl: 60000,
        limit: 10,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
