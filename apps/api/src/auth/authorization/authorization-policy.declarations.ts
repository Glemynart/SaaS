import { AuthorizationPolicyKind } from './authorization-policy';

const AUTHENTICATED_CONTROLLER_POLICIES = new Set([
  'AlertsController',
  'BillingController',
  'CustomerReceiptsController',
  'CentrosCostoController',
  'ContractsController',
  'ContractualProfilesController',
  'CuentasContablesController',
  'CuentaSistemaMapController',
  'DaneController',
  'DocumentProfileConfigurationsController',
  'DocumentResolutionController',
  'EmployeesController',
  'ExpedienteDocsController',
  'GeneratedDocumentsController',
  'LiquidationController',
  'LedgerReportController',
  'LaborRelationshipsController',
  'LotesController',
  'PayrollController',
  'PeriodosContablesController',
  'SedesController',
  'TenantBrandingController',
  'TercerosController',
  'TiposComprobanteController',
  'UsersController',
]);

export const getDeclaredControllerPolicy = (
  controllerName: string,
): AuthorizationPolicyKind | undefined =>
  AUTHENTICATED_CONTROLLER_POLICIES.has(controllerName)
    ? AuthorizationPolicyKind.AUTHENTICATED
    : undefined;
