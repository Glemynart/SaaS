import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSocialSecurityAffiliationDto } from './create-social-security-affiliation.dto';

describe('CreateSocialSecurityAffiliationDto PILA subtype', () => {
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
});
