import { Module } from '@nestjs/common';
import { OpeningHoursService } from './opening-hours.service';
import { OpeningHoursController } from './opening-hours.controller';

@Module({
  providers: [OpeningHoursService],
  controllers: [OpeningHoursController]
})
export class OpeningHoursModule {}
