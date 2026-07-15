import type { INestApplication } from '@nestjs/common';
import helmet, { type HelmetOptions } from 'helmet';

export const securityHeadersOptions = {
  // This process serves API responses, /uploads assets, and inline PDFs.
  // It does not serve the frontend or Swagger.
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'none'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
    },
  },
  crossOriginResourcePolicy: false,
  frameguard: { action: 'sameorigin' },
  hsts: {
    maxAge: 31_536_000,
    includeSubDomains: true,
  },
  noSniff: true,
} satisfies HelmetOptions;

export function applySecurityHeaders(app: INestApplication): void {
  app.use(helmet(securityHeadersOptions));
}
