import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class UpdateStatusDto {
  @ApiProperty({
    enum: AppointmentStatus,
    example: AppointmentStatus.CONFIRMED,
    description:
      'Le passage à COMPLETED crédite automatiquement les points de fidélité.',
  })
  @IsEnum(AppointmentStatus)
  status!: AppointmentStatus;
}