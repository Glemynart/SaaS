import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { HttpObservabilityMiddleware } from './http-observability.middleware';

class TestResponse extends EventEmitter {
  statusCode = 200;
  readonly headers = new Map<string, string>();

  setHeader(name: string, value: string): this {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }
}

function requestWithHeader(value?: string): Request {
  return {
    method: 'GET',
    route: { path: '/health' },
    header: (name: string) => (name === 'x-request-id' ? value : undefined),
  } as unknown as Request;
}

describe('HttpObservabilityMiddleware', () => {
  let middleware: HttpObservabilityMiddleware;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    middleware = new HttpObservabilityMiddleware();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('propagates a safe incoming request id and logs route metrics without request data', () => {
    const response = new TestResponse();
    const next: NextFunction = jest.fn();

    middleware.use(
      requestWithHeader('run-123'),
      response as unknown as Response,
      next,
    );
    response.emit('finish');

    expect(response.headers.get('x-request-id')).toBe('run-123');
    expect(next).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"requestId":"run-123"'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"route":"/health"'),
    );
    const logCalls = logSpy.mock.calls as unknown[][];
    const logMessage = logCalls[0]?.[0];
    expect(typeof logMessage === 'string' ? logMessage : '').not.toContain(
      'authorization',
    );
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('replaces an invalid request id and classifies failed responses', () => {
    const response = new TestResponse();
    response.statusCode = 503;

    middleware.use(
      requestWithHeader('bad id\nwith-log-injection'),
      response as unknown as Response,
      jest.fn(),
    );
    response.emit('finish');

    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"statusCode":503'),
    );
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('uses an opaque route for unmatched requests', () => {
    const response = new TestResponse();
    const request = requestWithHeader();
    delete (request as { route?: unknown }).route;

    middleware.use(request, response as unknown as Response, jest.fn());
    response.emit('finish');

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"route":"[unmatched]"'),
    );
  });
});
