import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';
import { CreateUserInvitationDto } from './dto/create-user-invitation.dto';
import { UserInvitationsService } from './user-invitations.service';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly invitationsService: UserInvitationsService,
  ) {}

  @Roles(UserRole.ADMIN)
  @Get('invitations')
  findInvitations(@CurrentUser() user: CurrentUserPayload) {
    return this.invitationsService.findAll(user.tenantId);
  }

  @Roles(UserRole.ADMIN)
  @Post('invitations')
  createInvitation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateUserInvitationDto,
  ) {
    return this.invitationsService.create(user.tenantId, user.userId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Post('invitations/:id/resend')
  @HttpCode(HttpStatus.OK)
  resendInvitation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.invitationsService.resend(user.tenantId, user.userId, id);
  }

  @Roles(UserRole.ADMIN)
  @Post('invitations/:id/revoke')
  @HttpCode(HttpStatus.OK)
  revokeInvitation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.invitationsService.revoke(user.tenantId, user.userId, id);
  }

  @Roles(UserRole.ADMIN)
  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.findAllManaged(user.tenantId);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateManagedUserDto,
  ) {
    return this.usersService.createManaged(user.tenantId, user.userId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateManagedUserDto,
  ) {
    return this.usersService.updateManaged(user.tenantId, user.userId, id, dto);
  }
}
