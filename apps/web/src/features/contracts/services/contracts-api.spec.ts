import { contractsApi } from './contracts-api';

describe('contractsApi.generateDocument', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('invoca la ruta de generación contractual con la plantilla elegida', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'generated-document-001',
        pdfUrl: '/uploads/pdfs/generated-document-001.pdf',
        nombre: 'Contrato — Andrea Prueba',
      }),
    });
    global.fetch = fetchMock;

    await expect(contractsApi.generateDocument('contract-001', 'template-001')).resolves.toEqual({
      id: 'generated-document-001',
      pdfUrl: '/uploads/pdfs/generated-document-001.pdf',
      nombre: 'Contrato — Andrea Prueba',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/contracts/contract-001/generate-document',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ templateId: 'template-001' }),
      }),
    );
  });
});
