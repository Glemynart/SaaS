import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserInvitationsService } from './user-invitations.service';

@Module({
  imports: [TenantsModule],
  controllers: [UsersController],
  providers: [UsersService, UserInvitationsService],
  exports: [UsersService, UserInvitationsService],
})
export class UsersModule {}
