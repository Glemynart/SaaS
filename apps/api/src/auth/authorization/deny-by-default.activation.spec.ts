import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { AuthorizationActivationIneligibleError } from './authorization-activation-eligibility';
import { activateDenyByDefault } from './deny-by-default.activation';
import { DenyByDefaultGuard } from './deny-by-default.guard';

describe('activateDenyByDefault', () => {
  it('registers the global enforcement guard only after eligibility succeeds', () => {
    const app = applicationSpy();

    activateDenyByDefault(app, AppModule);

    expect(app.useGlobalGuards).toHaveBeenCalledTimes(1);
    expect(app.useGlobalGuards).toHaveBeenCalledWith(
      expect.any(DenyByDefaultGuard),
    );
  });

  it('does not register enforcement when eligibility fails', () => {
    @Controller('unclassified')
    class UnclassifiedController {
      @Get()
      findAll() {}
    }

    @Module({ controllers: [UnclassifiedController] })
    class IneligibleModule {}

    const app = applicationSpy();

    expect(() => activateDenyByDefault(app, IneligibleModule)).toThrow(
      AuthorizationActivationIneligibleError,
    );
    expect(app.useGlobalGuards).not.toHaveBeenCalled();
  });
});

function applicationSpy(): jest.Mocked<
  Pick<INestApplication, 'useGlobalGuards'>
> {
  return {
    useGlobalGuards: jest.fn(),
  };
}
