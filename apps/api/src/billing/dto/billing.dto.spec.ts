import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { InvoiceItemDto, UpdateProductDto } from './billing.dto';

describe('Billing tax rate validation', () => {
  it('accepts a zero rate and a rate with two decimal places', () => {
    for (const impuesto of [0, 8.25]) {
      const dto = Object.assign(new InvoiceItemDto(), {
        descripcion: 'Servicio',
        cantidad: 1,
        valorUnitario: 100,
        impuesto,
      });

      expect(validateSync(dto)).toHaveLength(0);
    }
  });

  it('rejects a tax rate with more precision than the persisted snapshot', () => {
    const dto = Object.assign(new InvoiceItemDto(), {
      descripcion: 'Servicio',
      cantidad: 1,
      valorUnitario: 100,
      impuesto: 1.005,
    });

    expect(validateSync(dto)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'impuesto' }),
      ]),
    );
  });

  it('rejects null as an update to a non-nullable product rate', () => {
    const dto = Object.assign(new UpdateProductDto(), { impuesto: null });

    expect(validateSync(dto)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'impuesto' }),
      ]),
    );
  });

  it('allows omitting the tax rate when another product field is updated', () => {
    const dto = Object.assign(new UpdateProductDto(), {
      nombre: 'Servicio nuevo',
    });

    expect(validateSync(dto)).toHaveLength(0);
  });
});
