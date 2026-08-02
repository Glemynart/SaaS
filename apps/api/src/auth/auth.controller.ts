import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Ip,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ActiveTenantGuard } from './guards/active-tenant.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { CurrentUserPayload } from './decorators/current-user.decorator';
import type { Request } from 'express';
import { ThrottlerGuard, Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuditService } from '../audit/audit.service';
import {
  Authenticated,
  Unauthenticated,
} from './authorization/authorization-policy';

const REGISTER_RATE_LIMIT = process.env.NODE_ENV === 'test' ? 50 : 3;
const LOGIN_RATE_LIMIT = process.env.NODE_ENV === 'test' ? 50 : 5;
const REFRESH_RATE_LIMIT = process.env.NODE_ENV === 'test' ? 50 : 10;
const FORGOT_PASSWORD_RATE_LIMIT = process.env.NODE_ENV === 'test' ? 50 : 3;
const RESET_PASSWORD_RATE_LIMIT = process.env.NODE_ENV === 'test' ? 50 : 5;

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private passwordResetService: PasswordResetService,
    private auditService: AuditService,
  ) {}

  @Unauthenticated()
  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ register: { limit: REGISTER_RATE_LIMIT, ttl: 60000 } })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Unauthenticated()
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ login: { limit: LOGIN_RATE_LIMIT, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Ip() ip: string) {
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.login({
      ...dto,
      userAgent,
      ipAddress: ip,
    });
    if (result?.user) {
      await this.auditService
        .log({
          tenantId: result.user.tenantId,
          userId: result.user.id,
          action: 'LOGIN',
          entityType: 'Auth',
          metadata: { ip, userAgent: String(userAgent ?? '') },
        })
        .catch(() => {});
    }
    return result;
  }

  @Unauthenticated()
  @Post('refresh')
  @UseGuards(ThrottlerGuard)
  @Throttle({ refresh: { limit: REFRESH_RATE_LIMIT, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'];
    return this.authService.refresh(dto.refreshToken, userAgent, ip);
  }

  @Unauthenticated()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Sesión cerrada exitosamente.' };
  }

  @Authenticated()
  @UseGuards(JwtAuthGuard, ActiveTenantGuard)
  @Get('me')
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return user;
  }

  @Unauthenticated()
  @Post('forgot-password')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    forgotPassword: { limit: FORGOT_PASSWORD_RATE_LIMIT, ttl: 3600000 },
  })
  @SkipThrottle({
    login: true,
    register: true,
    refresh: true,
    resetPassword: true,
  })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'];
    return this.passwordResetService.requestReset({
      tenantNit: dto.tenantNit,
      email: dto.email,
      ipAddress: ip,
      userAgent: String(userAgent ?? ''),
    });
  }

  @Unauthenticated()
  @Post('reset-password')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    resetPassword: { limit: RESET_PASSWORD_RATE_LIMIT, ttl: 900000 },
  })
  @SkipThrottle({
    login: true,
    register: true,
    refresh: true,
    forgotPassword: true,
  })
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'];
    return this.passwordResetService.consumeReset({
      token: dto.token,
      newPassword: dto.newPassword,
      ipAddress: ip,
      userAgent: String(userAgent ?? ''),
    });
  }
}
