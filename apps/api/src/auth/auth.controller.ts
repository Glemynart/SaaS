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
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ActiveTenantGuard } from './guards/active-tenant.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { CurrentUserPayload } from './decorators/current-user.decorator';
import type { Request } from 'express';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ register: { limit: 3, ttl: 60000 } })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ login: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Ip() ip: string) {
    const userAgent = req.headers['user-agent'];
    return this.authService.login({
      ...dto,
      userAgent,
      ipAddress: ip,
    });
  }

  @Post('refresh')
  @UseGuards(ThrottlerGuard)
  @Throttle({ refresh: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'];
    return this.authService.refresh(dto.refreshToken, userAgent, ip);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Sesión cerrada exitosamente.' };
  }

  @UseGuards(JwtAuthGuard, ActiveTenantGuard)
  @Get('me')
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return user;
  }
}
