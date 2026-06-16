import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user?: {
    userId: string;
    tenantId: string;
    rol: string;
    email: string;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Token de acceso no proporcionado.');
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('Configuración JWT no disponible.');
    }
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        tenantId: string;
        rol: string;
        email: string;
      }>(token, { secret });
      (request as RequestWithUser).user = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        rol: payload.rol,
        email: payload.email,
      };
    } catch {
      throw new UnauthorizedException('Token de acceso inválido o expirado.');
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
