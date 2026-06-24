import { PdfRenderService } from './pdf-render.service';

describe('PdfRenderService', () => {
  let service: PdfRenderService;

  const mockPageClose = jest.fn().mockResolvedValue(undefined);
  const mockPagePdf = jest.fn().mockResolvedValue(Buffer.from('PDF'));
  const mockPageSetContent = jest.fn().mockResolvedValue(undefined);
  const mockBrowserClose = jest.fn().mockResolvedValue(undefined);
  const mockNewPage = jest.fn();

  function makeBrowser(connected = true) {
    return {
      newPage: mockNewPage,
      close: mockBrowserClose,
      connected,
    };
  }

  function makePage() {
    return {
      setContent: mockPageSetContent,
      pdf: mockPagePdf,
      close: mockPageClose,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockNewPage.mockResolvedValue(makePage());
    service = new PdfRenderService();
    jest
      .spyOn(service as never, 'launchBrowser' as never)
      .mockResolvedValue(makeBrowser() as never);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('renderiza HTML a PDF y devuelve Buffer', async () => {
    const result = await service.renderPdf('<p>test</p>');

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(mockPageSetContent).toHaveBeenCalledWith('<p>test</p>', {
      waitUntil: 'domcontentloaded',
    });
    expect(mockPagePdf).toHaveBeenCalledWith({
      format: 'A4',
      margin: { top: '2cm', bottom: '2cm', left: '2.5cm', right: '2.5cm' },
      printBackground: true,
    });
  });

  it('reutiliza el browser singleton entre renders', async () => {
    const launchSpy = jest.spyOn(service as never, 'launchBrowser' as never);

    await service.renderPdf('<p>1</p>');
    await service.renderPdf('<p>2</p>');

    expect(launchSpy).toHaveBeenCalledTimes(1);
  });

  it('cierra la page después de cada render exitoso', async () => {
    await service.renderPdf('<p>test</p>');

    expect(mockPageClose).toHaveBeenCalledTimes(1);
  });

  it('cierra la page cuando page.pdf() falla', async () => {
    mockPagePdf.mockRejectedValueOnce(new Error('pdf failed'));

    await expect(service.renderPdf('<p>test</p>')).rejects.toThrow(
      'pdf failed',
    );
    expect(mockPageClose).toHaveBeenCalledTimes(1);
  });

  it('cierra la page cuando setContent falla', async () => {
    mockPageSetContent.mockRejectedValueOnce(new Error('content failed'));

    await expect(service.renderPdf('<p>test</p>')).rejects.toThrow(
      'content failed',
    );
    expect(mockPageClose).toHaveBeenCalledTimes(1);
  });

  it('reabre el browser si está desconectado', async () => {
    const launchSpy = jest.spyOn(service as never, 'launchBrowser' as never);
    launchSpy.mockResolvedValue(makeBrowser(true) as never);

    await service.renderPdf('<p>1</p>');
    expect(launchSpy).toHaveBeenCalledTimes(1);

    // Simulate disconnect
    const deadBrowser = makeBrowser(false);
    (service as unknown as { browser: unknown }).browser = deadBrowser;

    await service.renderPdf('<p>2</p>');
    expect(launchSpy).toHaveBeenCalledTimes(2);
  });

  it('onModuleDestroy cierra el browser', async () => {
    await service.renderPdf('<p>test</p>');
    mockBrowserClose.mockClear();

    await service.onModuleDestroy();

    expect(mockBrowserClose).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy no falla si no hay browser', async () => {
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
