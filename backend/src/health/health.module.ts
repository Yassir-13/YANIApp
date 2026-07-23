import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// PrismaService est fourni globalement (PrismaModule est @Global).
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
