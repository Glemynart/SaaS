import { INestApplication, Type } from '@nestjs/common';
import { AuthorizationActivationEligibilityEvaluator } from './authorization-activation-eligibility';
import { DenyByDefaultGuard } from './deny-by-default.guard';

export const activateDenyByDefault = (
  app: Pick<INestApplication, 'useGlobalGuards'>,
  rootModule: Type<unknown>,
): void => {
  new AuthorizationActivationEligibilityEvaluator().assertEligible(rootModule);
  app.useGlobalGuards(new DenyByDefaultGuard());
};
