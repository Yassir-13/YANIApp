import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [LoyaltyModule, SettingsModule],
  providers: [AppointmentsService],
  controllers: [AppointmentsController],
})
export class AppointmentsModule {}