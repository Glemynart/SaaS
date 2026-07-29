const mockCreate = jest.fn();
const mockApplySecurityHeaders = jest.fn();
const mockActivateDenyByDefault = jest.fn();

jest.mock('@nestjs/core', () => ({
  ...jest.requireActual('@nestjs/core'),
  NestFactory: { create: mockCreate },
}));

jest.mock('./app.module', () => ({
  AppModule: class MockAppModule {},
}));

jest.mock('./security/security-headers', () => ({
  applySecurityHeaders: mockApplySecurityHeaders,
}));

jest.mock('./auth/authorization/deny-by-default.activation', () => ({
  activateDenyByDefault: mockActivateDenyByDefault,
}));

describe('production HTTP bootstrap composition', () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const app = {
    useGlobalPipes: jest.fn(),
    useStaticAssets: jest.fn(),
    enableCors: jest.fn(),
    listen: jest.fn(),
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.ALLOWED_ORIGINS =
      'https://tenant-a.example, http://localhost:3000 ';
    mockCreate.mockResolvedValue(app);
    app.listen.mockResolvedValue(undefined);
  });

  afterAll(() => {
    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it('registers the production security pipeline before accepting HTTP requests', async () => {
    require('./main');
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockApplySecurityHeaders).toHaveBeenCalledWith(app);
    expect(mockActivateDenyByDefault).toHaveBeenCalledWith(
      app,
      expect.any(Function),
    );
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(app.useStaticAssets).toHaveBeenCalledWith(
      expect.stringMatching(/[\\/]uploads[\\/]logos$/),
      { prefix: '/uploads/logos/' },
    );
    expect(app.enableCors).toHaveBeenCalledWith({
      origin: ['https://tenant-a.example', 'http://localhost:3000'],
      credentials: true,
    });
    expect(app.listen).toHaveBeenCalledTimes(1);

    expect(mockApplySecurityHeaders.mock.invocationCallOrder[0]).toBeLessThan(
      mockActivateDenyByDefault.mock.invocationCallOrder[0],
    );
    expect(mockActivateDenyByDefault.mock.invocationCallOrder[0]).toBeLessThan(
      app.listen.mock.invocationCallOrder[0],
    );
  });
});
