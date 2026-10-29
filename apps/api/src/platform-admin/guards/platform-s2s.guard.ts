import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthenticationGuard } from '../../auth/authorization/authorization-policy';

export const PLATFORM_S2S_SCOPE = 'DUSEMA_TENANT_READ';
export const PLATFORM_S2S_SUB = 'pos-platform';

export interface PlatformS2sClaims {
  iss: string;
  aud: string | string[];
  scope: string;
  sub: string;
  actorUid: string;
  empresaPosId: string;
  correlationId: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface PlatformS2sRequest extends Request {
  platformS2s?: PlatformS2sClaims;
}

interface PlatformS2sConfig {
  issuer?: string;
  audience?: string;
  publicKey?: string;
  kid?: string;
}

interface CompleteJwt {
  header: {
    alg?: unknown;
    kid?: unknown;
  };
}

const SAFE_KID = /^[A-Za-z0-9._-]{1,128}$/;

@AuthenticationGuard()
@Injectable()
export class PlatformS2sGuard implements CanActivate {
  private readonly logger = new Logger(PlatformS2sGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PlatformS2sRequest>();
    delete request.platformS2s;

    const token = this.extractTokenFromHeader(request);
    if (!token) return this.reject('TOKEN_MISSING');

    const platformConfig = this.getConfig();
    if (!platformConfig) return this.reject('CONFIGURATION_UNAVAILABLE');

    try {
      const header = this.decodeHeader(token);
      if (
        !header ||
        header.alg !== 'RS256' ||
        typeof header.kid !== 'string' ||
        !SAFE_KID.test(header.kid) ||
        header.kid !== platformConfig.kid
      ) {
        return this.reject('KID_INVALID');
      }

      const payload = await this.jwtService.verifyAsync<
        Record<string, unknown>
      >(token, {
        publicKey: platformConfig.publicKey,
        algorithms: ['RS256'],
        issuer: platformConfig.issuer,
        audience: platformConfig.audience,
      });

      if (!this.isValidClaims(payload)) {
        return this.reject('CLAIMS_INVALID');
      }

      if (!this.hasRequiredScope(payload.scope)) {
        return this.reject('SCOPE_INVALID');
      }

      request.platformS2s = payload;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;

      this.logRejected('JWT_INVALID');
      throw new UnauthorizedException('Token S2S inválido o expirado.');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : undefined;
  }

  private getConfig(): Required<PlatformS2sConfig> | undefined {
    const configured = this.config.get<PlatformS2sConfig>('platformS2s') ?? {};
    const issuer = configured.issuer ?? process.env.PLATFORM_S2S_ISSUER;
    const audience = configured.audience ?? process.env.PLATFORM_S2S_AUDIENCE;
    const publicKey =
      configured.publicKey ?? process.env.PLATFORM_S2S_PUBLIC_KEY;
    const kid = configured.kid ?? process.env.PLATFORM_S2S_KID;

    if (
      !isNonEmptyString(issuer) ||
      !isNonEmptyString(audience) ||
      !isNonEmptyString(publicKey) ||
      !isNonEmptyString(kid)
    ) {
      return undefined;
    }

    return {
      issuer,
      audience,
      publicKey: publicKey.replace(/\\n/g, '\n'),
      kid,
    };
  }

  private decodeHeader(token: string): CompleteJwt['header'] | undefined {
    const decoded: unknown = this.jwtService.decode(token, { complete: true });

    if (!isRecord(decoded) || !isRecord(decoded.header)) {
      return undefined;
    }

    return decoded.header;
  }

  private isValidClaims(payload: unknown): payload is PlatformS2sClaims {
    if (!isRecord(payload)) return false;

    const requiredStringClaims = [
      'iss',
      'scope',
      'actorUid',
      'empresaPosId',
      'correlationId',
      'jti',
    ];
    if (
      requiredStringClaims.some((claim) => !isNonEmptyString(payload[claim]))
    ) {
      return false;
    }

    if (payload.sub !== PLATFORM_S2S_SUB) return false;

    const audience = payload.aud;
    const validAudience =
      isNonEmptyString(audience) ||
      (Array.isArray(audience) &&
        audience.length > 0 &&
        audience.every(isNonEmptyString));
    if (!validAudience) return false;

    return isJwtTimestamp(payload.iat) && isJwtTimestamp(payload.exp);
  }

  private hasRequiredScope(scope: string): boolean {
    return scope.split(/\s+/).filter(Boolean).includes(PLATFORM_S2S_SCOPE);
  }

  private reject(reason: string): never {
    this.logRejected(reason);
    throw new UnauthorizedException('Token S2S inválido o expirado.');
  }

  private logRejected(reason: string): void {
    this.logger.warn(
      JSON.stringify({
        event: 'PLATFORM_S2S_AUTHENTICATION',
        result: 'REJECTED',
        reason,
        correlationId: null,
      }),
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isJwtTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
