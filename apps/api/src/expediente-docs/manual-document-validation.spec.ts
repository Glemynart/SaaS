import { BadRequestException } from '@nestjs/common';
import {
  MAX_MANUAL_DOCUMENT_SIZE,
  validateManualDocument,
} from './manual-document-validation';

describe('validateManualDocument', () => {
  it('accepts a PDF when the extension and magic bytes match', () => {
    const buffer = Buffer.from('%PDF-1.7\ncontenido');
    const result = validateManualDocument({
      originalname: 'contrato.pdf',
      buffer,
    });

    expect(result).toEqual({
      extension: 'pdf',
      mimeType: 'application/pdf',
      originalName: 'contrato.pdf',
      size: buffer.length,
    });
  });

  it('rejects a file whose extension does not match its detected format', () => {
    expect(() =>
      validateManualDocument({
        originalname: 'contrato.pdf',
        buffer: Buffer.from('not a PDF'),
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      validateManualDocument({
        originalname: 'contrato.jpg',
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      }),
    ).not.toThrow();
  });

  it('rejects files over the manual upload limit', () => {
    expect(() =>
      validateManualDocument({
        originalname: 'large.pdf',
        buffer: Buffer.alloc(MAX_MANUAL_DOCUMENT_SIZE + 1),
      }),
    ).toThrow('5 MB');
  });
});
