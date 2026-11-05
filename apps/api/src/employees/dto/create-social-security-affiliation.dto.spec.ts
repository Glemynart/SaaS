import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSocialSecurityAffiliationDto } from './create-social-security-affiliation.dto';

describe('CreateSocialSecurityAffiliationDto PILA subtype', () => {
  async function pensionTariffErrors(value: unknown) {
    const input = plainToInstance(CreateSocialSecurityAffiliationDto, {
      indicadorTarifaEspecialPensiones: value,
    });
    const errors = await validate(input);
    return errors.find(
      ({ property }) => property === 'indicadorTarifaEspecialPensiones',
    );
  }

  async function pensionTransitionErrors(value: unknown) {
    const input = plainToInstance(CreateSocialSecurityAffiliationDto, {
      estadoAfiliacionPensional: value,
    });
    const errors = await validate(input);
    return errors.find(
      ({ property }) => property === 'estadoAfiliacionPensional',
    );
  }

  async function subtypeErrors(value: unknown) {
    const input = plainToInstance(CreateSocialSecurityAffiliationDto, {
      subtipoCotizanteCodigo: value,
    });
    const errors = await validate(input);
    return errors.find(({ property }) => property === 'subtipoCotizanteCodigo');
  }

  it('requires an explicit two-digit subtype and accepts 00 for no special subtype', async () => {
    expect(await subtypeErrors('00')).toBeUndefined();
    expect((await subtypeErrors(undefined))?.constraints).toHaveProperty(
      'isDefined',
    );
    expect((await subtypeErrors(''))?.constraints).toHaveProperty('matches');
    expect((await subtypeErrors('0'))?.constraints).toHaveProperty('matches');
  });

  it('accepts only a confirmed pension transition value and allows unknown history', async () => {
    expect(await pensionTransitionErrors('S')).toBeUndefined();
    expect(await pensionTransitionErrors('N')).toBeUndefined();
    expect(await pensionTransitionErrors(' s ')).toBeUndefined();
    expect(await pensionTransitionErrors(undefined)).toBeUndefined();
    expect((await pensionTransitionErrors('X'))?.constraints).toHaveProperty(
      'isIn',
    );
  });

  it('accepts a blank normal tariff, explicit special codes, or unknown history', async () => {
    expect(await pensionTariffErrors('')).toBeUndefined();
    expect(await pensionTariffErrors('1')).toBeUndefined();
    expect(await pensionTariffErrors('2')).toBeUndefined();
    expect(await pensionTariffErrors('3')).toBeUndefined();
    expect(await pensionTariffErrors('4')).toBeUndefined();
    expect(await pensionTariffErrors(undefined)).toBeUndefined();
    expect((await pensionTariffErrors('5'))?.constraints).toHaveProperty(
      'isIn',
    );
  });
});
