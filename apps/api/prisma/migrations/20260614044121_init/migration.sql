-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('STARTER', 'PROFESIONAL', 'OPERADOR_EDUCATIVO');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERADOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "EmpleadoEstado" AS ENUM ('ACTIVO', 'INACTIVO', 'SUSPENDIDO', 'RETIRADO');

-- CreateEnum
CREATE TYPE "ContratoTipo" AS ENUM ('TERMINO_FIJO', 'TERMINO_INDEFINIDO', 'OBRA_LABOR', 'APRENDIZAJE', 'PRESTACION_SERVICIOS');

-- CreateEnum
CREATE TYPE "ContratoEstado" AS ENUM ('VIGENTE', 'VENCIDO', 'TERMINADO', 'RENOVADO');

-- CreateEnum
CREATE TYPE "LoteEstado" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'COMPLETADO_CON_ERRORES', 'FALLIDO');

-- CreateEnum
CREATE TYPE "PlantillaTipo" AS ENUM ('CONTRATO', 'PREAVISO', 'TERMINACION', 'CERTIFICADO', 'OTRO');

-- CreateEnum
CREATE TYPE "ExpedienteCategoria" AS ENUM ('CONTRATO', 'AFILIACION', 'CERTIFICADO', 'DOCUMENTO_PERSONAL', 'PREAVISO', 'TERMINACION', 'OTRO');

-- CreateEnum
CREATE TYPE "AlertaTipo" AS ENUM ('CONTRATO_POR_VENCER', 'CONTRATO_VENCIDO');

-- CreateEnum
CREATE TYPE "AlertaEstado" AS ENUM ('PENDIENTE', 'ENVIADA', 'FALLIDA');

-- CreateEnum
CREATE TYPE "ClienteFERegimen" AS ENUM ('SIMPLIFICADO', 'COMUN', 'GRAN_CONTRIBUYENTE', 'NO_RESPONSABLE');

-- CreateEnum
CREATE TYPE "FacturaEstado" AS ENUM ('BORRADOR', 'ENVIANDO', 'ACEPTADA', 'RECHAZADA', 'ERROR_TECNICO');

-- CreateEnum
CREATE TYPE "FacturaTipo" AS ENUM ('FACTURA_VENTA', 'NOTA_CREDITO', 'NOTA_DEBITO');

-- CreateEnum
CREATE TYPE "ImpuestoTipo" AS ENUM ('IVA_0', 'IVA_5', 'IVA_19', 'EXCLUIDO', 'EXENTO');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "digitoVerif" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "direccion" TEXT,
    "ciudad" TEXT,
    "departamento" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "logoUrl" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'STARTER',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "trialEndsAt" TIMESTAMP(3),
    "feActivo" BOOLEAN NOT NULL DEFAULT false,
    "feResolucion" TEXT,
    "feResolucionFecha" TIMESTAMP(3),
    "feResolucionVence" TIMESTAMP(3),
    "fePrefijo" TEXT,
    "feRangoDesde" INTEGER,
    "feRangoHasta" INTEGER,
    "feUltimoNumero" INTEGER,
    "feTecnicoId" TEXT,
    "feTecnicoKey" TEXT,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "rol" "UserRole" NOT NULL DEFAULT 'OPERADOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleados" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL DEFAULT 'CC',
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "cargo" TEXT NOT NULL,
    "dependencia" TEXT,
    "sede" TEXT,
    "salario" DECIMAL(12,2) NOT NULL,
    "tipoContrato" "ContratoTipo" NOT NULL DEFAULT 'TERMINO_FIJO',
    "fechaIngreso" TIMESTAMP(3) NOT NULL,
    "estado" "EmpleadoEstado" NOT NULL DEFAULT 'ACTIVO',
    "eps" TEXT,
    "arl" TEXT,
    "fondoPension" TEXT,
    "cajaCompensacion" TEXT,

    CONSTRAINT "empleados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "PlantillaTipo" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "variablesMapa" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "plantillas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "plantillaId" TEXT,
    "loteId" TEXT,
    "tipo" "ContratoTipo" NOT NULL,
    "estado" "ContratoEstado" NOT NULL DEFAULT 'VIGENTE',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "cargo" TEXT NOT NULL,
    "salario" DECIMAL(12,2) NOT NULL,
    "pdfKey" TEXT,
    "docxKey" TEXT,
    "variablesSnapshot" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_contrato" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plantillaId" TEXT NOT NULL,
    "estado" "LoteEstado" NOT NULL DEFAULT 'PENDIENTE',
    "total" INTEGER NOT NULL,
    "procesados" INTEGER NOT NULL DEFAULT 0,
    "fallidos" INTEGER NOT NULL DEFAULT 0,
    "iniciadoAt" TIMESTAMP(3),
    "completadoAt" TIMESTAMP(3),
    "zipKey" TEXT,
    "erroresLog" JSONB DEFAULT '[]',
    "configuracion" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "lotes_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expediente_docs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "categoria" "ExpedienteCategoria" NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "subidoPorId" TEXT,
    "subidoPorNombre" TEXT,

    CONSTRAINT "expediente_docs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "tipo" "AlertaTipo" NOT NULL,
    "estado" "AlertaEstado" NOT NULL DEFAULT 'PENDIENTE',
    "diasAnticipacion" INTEGER NOT NULL,
    "enviadaAt" TIMESTAMP(3),
    "destinatario" TEXT,
    "errorMensaje" TEXT,

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes_fe" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "digitoVerif" TEXT,
    "tipoDocumento" TEXT NOT NULL DEFAULT 'NIT',
    "regimen" "ClienteFERegimen" NOT NULL DEFAULT 'COMUN',
    "email" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "departamento" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "clientes_fe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "codigoDIAN" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precioBase" DECIMAL(12,2) NOT NULL,
    "impuesto" "ImpuestoTipo" NOT NULL DEFAULT 'IVA_19',
    "unidadMedida" TEXT NOT NULL DEFAULT '94',
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipo" "FacturaTipo" NOT NULL DEFAULT 'FACTURA_VENTA',
    "prefijo" TEXT,
    "numero" INTEGER NOT NULL,
    "estado" "FacturaEstado" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "totalIva" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "matiasId" TEXT,
    "cufe" TEXT,
    "qrCode" TEXT,
    "dianRespuesta" TEXT,
    "dianFecha" TIMESTAMP(3),
    "reintentos" INTEGER NOT NULL DEFAULT 0,
    "xmlKey" TEXT,
    "pdfKey" TEXT,
    "notas" TEXT,
    "facturaOrigenId" TEXT,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_factura" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "facturaId" TEXT NOT NULL,
    "productoId" TEXT,
    "codigoDIAN" TEXT,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,
    "precioUnitario" DECIMAL(12,2) NOT NULL,
    "impuesto" "ImpuestoTipo" NOT NULL,
    "porcentajeIva" DECIMAL(5,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "valorIva" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "unidadMedida" TEXT NOT NULL DEFAULT '94',

    CONSTRAINT "items_factura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_nit_key" ON "tenants"("nit");

-- CreateIndex
CREATE INDEX "users_tenantId_activo_idx" ON "users"("tenantId", "activo");

-- CreateIndex
CREATE INDEX "users_tenantId_rol_idx" ON "users"("tenantId", "rol");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tokenHash_idx" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "empleados_tenantId_estado_idx" ON "empleados"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "empleados_tenantId_cargo_idx" ON "empleados"("tenantId", "cargo");

-- CreateIndex
CREATE INDEX "empleados_tenantId_dependencia_idx" ON "empleados"("tenantId", "dependencia");

-- CreateIndex
CREATE INDEX "empleados_tenantId_deletedAt_idx" ON "empleados"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_tenantId_cedula_key" ON "empleados"("tenantId", "cedula");

-- CreateIndex
CREATE INDEX "plantillas_tenantId_tipo_idx" ON "plantillas"("tenantId", "tipo");

-- CreateIndex
CREATE INDEX "plantillas_tenantId_activa_idx" ON "plantillas"("tenantId", "activa");

-- CreateIndex
CREATE INDEX "contratos_tenantId_estado_idx" ON "contratos"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "contratos_tenantId_empleadoId_idx" ON "contratos"("tenantId", "empleadoId");

-- CreateIndex
CREATE INDEX "contratos_tenantId_fechaFin_idx" ON "contratos"("tenantId", "fechaFin");

-- CreateIndex
CREATE INDEX "contratos_tenantId_loteId_idx" ON "contratos"("tenantId", "loteId");

-- CreateIndex
CREATE INDEX "contratos_tenantId_tipo_idx" ON "contratos"("tenantId", "tipo");

-- CreateIndex
CREATE INDEX "lotes_contrato_tenantId_estado_idx" ON "lotes_contrato"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "lotes_contrato_tenantId_createdAt_idx" ON "lotes_contrato"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "expediente_docs_tenantId_empleadoId_idx" ON "expediente_docs"("tenantId", "empleadoId");

-- CreateIndex
CREATE INDEX "expediente_docs_tenantId_empleadoId_categoria_idx" ON "expediente_docs"("tenantId", "empleadoId", "categoria");

-- CreateIndex
CREATE INDEX "expediente_docs_tenantId_categoria_idx" ON "expediente_docs"("tenantId", "categoria");

-- CreateIndex
CREATE INDEX "alertas_tenantId_estado_idx" ON "alertas"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "alertas_tenantId_tipo_idx" ON "alertas"("tenantId", "tipo");

-- CreateIndex
CREATE INDEX "alertas_tenantId_createdAt_idx" ON "alertas"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "alertas_contratoId_diasAnticipacion_key" ON "alertas"("contratoId", "diasAnticipacion");

-- CreateIndex
CREATE INDEX "clientes_fe_tenantId_activo_idx" ON "clientes_fe"("tenantId", "activo");

-- CreateIndex
CREATE INDEX "clientes_fe_tenantId_razonSocial_idx" ON "clientes_fe"("tenantId", "razonSocial");

-- CreateIndex
CREATE INDEX "clientes_fe_tenantId_deletedAt_idx" ON "clientes_fe"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_fe_tenantId_nit_key" ON "clientes_fe"("tenantId", "nit");

-- CreateIndex
CREATE INDEX "productos_tenantId_activo_idx" ON "productos"("tenantId", "activo");

-- CreateIndex
CREATE INDEX "productos_tenantId_nombre_idx" ON "productos"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "productos_tenantId_codigo_key" ON "productos"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "facturas_tenantId_estado_idx" ON "facturas"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "facturas_tenantId_clienteId_idx" ON "facturas"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "facturas_tenantId_fechaEmision_idx" ON "facturas"("tenantId", "fechaEmision");

-- CreateIndex
CREATE INDEX "facturas_tenantId_tipo_idx" ON "facturas"("tenantId", "tipo");

-- CreateIndex
CREATE INDEX "facturas_tenantId_cufe_idx" ON "facturas"("tenantId", "cufe");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_tenantId_prefijo_numero_key" ON "facturas"("tenantId", "prefijo", "numero");

-- CreateIndex
CREATE INDEX "items_factura_facturaId_idx" ON "items_factura"("facturaId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas" ADD CONSTRAINT "plantillas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes_contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_contrato" ADD CONSTRAINT "lotes_contrato_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_contrato" ADD CONSTRAINT "lotes_contrato_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expediente_docs" ADD CONSTRAINT "expediente_docs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expediente_docs" ADD CONSTRAINT "expediente_docs_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes_fe" ADD CONSTRAINT "clientes_fe_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes_fe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_facturaOrigenId_fkey" FOREIGN KEY ("facturaOrigenId") REFERENCES "facturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_factura" ADD CONSTRAINT "items_factura_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_factura" ADD CONSTRAINT "items_factura_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
