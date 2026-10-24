import { buildContentDispositionHeader } from './content-disposition';

describe('buildContentDispositionHeader', () => {
  it('sanitizes path separators, control characters, and quotes in filenames', () => {
    const header = buildContentDispositionHeader(
      'attachment',
      'carpeta/Contrato\\\r\n"Gómez".pdf',
    );

    expect(header).toBe(
      'attachment; filename="carpeta_Contrato____Gomez_.pdf"; filename*=UTF-8\'\'carpeta_Contrato___%22G%C3%B3mez%22.pdf',
    );
    expect(header).not.toMatch(/[\r\n/\\]/);
  });
});
