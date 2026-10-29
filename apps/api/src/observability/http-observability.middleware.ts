import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

@Injectable()
export class HttpObservabilityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HttpObservabilityMiddleware.name);

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = this.getRequestId(request.header(REQUEST_ID_HEADER));
    const startedAt = process.hrtime.bigint();

    response.setHeader(REQUEST_ID_HEADER, requestId);
    response.on('finish', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const route = request.route as unknown as { path?: unknown } | undefined;
      const event = JSON.stringify({
        event: 'HTTP_REQUEST',
        requestId,
        method: request.method,
        route: typeof route?.path === 'string' ? route.path : '[unmatched]',
        statusCode: response.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      });

      if (response.statusCode >= 500) {
        this.logger.error(event);
      } else if (response.statusCode >= 400) {
        this.logger.warn(event);
      } else {
        this.logger.log(event);
      }
    });

    next();
  }

  private getRequestId(candidate: string | undefined): string {
    return candidate && SAFE_REQUEST_ID.test(candidate)
      ? candidate
      : randomUUID();
  }
}
