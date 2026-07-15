import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Unauthenticated } from './auth/authorization/authorization-policy';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Unauthenticated()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
