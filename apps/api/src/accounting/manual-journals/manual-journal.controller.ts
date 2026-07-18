import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateManualJournalDto } from './dto/create-manual-journal.dto';
import { VoidManualJournalDto } from './dto/void-manual-journal.dto';
import { ManualJournalService } from './manual-journal.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('accounting/comprobantes')
export class ManualJournalController {
  constructor(private readonly manualJournals: ManualJournalService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  registrar(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateManualJournalDto,
  ) {
    return this.manualJournals.registrar(user.tenantId, user.userId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/anular')
  anular(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') comprobanteId: string,
    @Body() dto: VoidManualJournalDto,
  ) {
    return this.manualJournals.anular(
      user.tenantId,
      user.userId,
      comprobanteId,
      dto.motivo,
    );
  }
}
