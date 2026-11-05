# Seed financiero local de demostración

El comando carga datos ficticios para recorrer Facturación y Nómina en una
instalación local. No es una migración ni una rutina de inicialización de
producción. Para preparar el recorrido de interfaz, consulta el
[guion de demo financiera](./GOAL-02-financial-demo-runbook.md).

## Requisitos

- La base PostgreSQL debe estar en `localhost`, `127.0.0.1` o `::1` y tener las
  migraciones de la aplicación aplicadas.
- El catálogo global debe tener activo el tipo de comprobante `NOM`. El seed
  financiero no modifica catálogos globales.
- El tenant debe existir, estar activo y llamarse explícitamente `demo`,
  `prueba`, `test` o `E2E` en su nombre comercial o razón social.
- El usuario indicado debe ser ADMIN activo de ese mismo tenant.

## Preparar catálogos globales

Si el tipo `NOM` no existe o está inactivo, ejecuta primero el comando `pnpm --filter @saas/api prisma:seed` únicamente en la base local de demostración. Ese seed base crea o actualiza parámetros legales globales de 2026, tipos de comprobante y plantilla PUC; el seed financiero tenant-scoped no modifica esos catálogos. No ejecutes el seed base contra producción.

## Ejecutar en PowerShell

Configura `DATABASE_URL` para la base local de desarrollo, luego reemplaza los
dos UUID por el tenant y su usuario administrador:

```powershell
$demoTenantId = '<tenant-uuid>'
$adminUserId = '<admin-user-uuid>'
$env:NODE_ENV = 'development'
$env:FINANCIAL_DEMO_SEED_TENANT_ID = $demoTenantId

pnpm --filter @saas/api prisma:seed:financial-demo -- `
  --tenant-id $demoTenantId `
  --actor-id $adminUserId `
  --confirm-demo
```

El identificador debe coincidir tanto en `FINANCIAL_DEMO_SEED_TENANT_ID` como en
`--tenant-id`. La CLI rechaza otros entornos, bases con host remoto y tenants que
no se identifiquen como demostración.

## Datos creados

- Dos clientes y tres productos ficticios.
- Tres facturas internas `ISSUED` y una `DRAFT`, con impuesto interno del 19%.
  Cada factura `ISSUED` se emite mediante `BillingService` y crea, en la misma
  transacción tenant-scoped, un comprobante balanceado en Ledger con cuentas
  por cobrar, ingreso y el impuesto aplicable. La factura `DRAFT` no crea
  comprobante. `ISSUED` es un estado interno: no significa transmisión ni
  validación fiscal DIAN.
- Dos recaudos sintéticos por transferencia: uno parcial aplicado a una factura
  y otro distribuido entre dos facturas emitidas del mismo cliente. Cada recaudo
  crea un comprobante CI balanceado y la cartera deriva abonos y saldos por
  factura desde sus aplicaciones. Las referencias `DEMO-TRX-*` identifican datos
  ficticios; no confirman transferencias bancarias reales.
- Un empleado sintético, su tercero canónico marcado como empleado y un centro
  de costo para satisfacer las dimensiones requeridas por el PUC.
- Un período de nómina aprobado con un snapshot marcado como sintético y no
  operativo, una liquidación ficticia de COP 1.000.000 y deducciones de COP
  80.000.
- Las cuentas y mapeos PUC que falten para la causación, un período contable
  abierto si hace falta y un comprobante de nómina balanceado en Ledger.

Los identificadores son estables y se calculan dentro del tenant objetivo. La
segunda ejecución conserva los mismos registros y no crea duplicados. Si un
registro con uno de esos identificadores existe en otro tenant, o un código
sintético ya está ocupado, el comando aborta sin reasignarlo. El seed no borra ni
sobrescribe datos existentes.

## Límites operativos

Los datos usan nombres, correos y documentos reservados para demostración. No
son apropiados para liquidaciones laborales, facturación fiscal, DIAN, UGPP,
pagos o declaraciones reales. Las facturas emitidas y la causación de nómina
crean comprobantes internos contabilizados; el Ledger es append-only y esos
comprobantes no se eliminan. Para corregirlos, se debe usar el flujo de
reversión contable vigente.

No se incluye una rutina de limpieza. Para repetir una grabación, reutiliza la
misma demo sin volver a crear filas; para una demo limpia, usa un tenant local
vacío y explícitamente identificado como demo. No ejecutes el comando contra
staging, producción, túneles ni copias de datos reales.
