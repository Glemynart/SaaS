import { expedienteDocsApi } from './expediente-docs-api';

describe('expedienteDocsApi.uploadManual', () => {
  it('sends the file and category as multipart form data', async () => {
    const document = { id: 'doc-001' };
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => document,
    } as Response);
    const file = new File([Buffer.from('%PDF-1.7')], 'cedula.pdf', {
      type: 'application/pdf',
    });

    await expect(
      expedienteDocsApi.uploadManual('employee-001', file, 'DOCUMENTO_PERSONAL'),
    ).resolves.toEqual(document);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/employees/employee-001/expediente',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
        headers: {},
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = request.body as FormData;
    expect(body.get('categoria')).toBe('DOCUMENTO_PERSONAL');
    expect(body.get('file')).toEqual(file);

    fetchMock.mockRestore();
  });
});
