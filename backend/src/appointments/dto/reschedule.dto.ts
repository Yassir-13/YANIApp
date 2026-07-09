import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class RescheduleDto {
  @ApiProperty({
    description: 'Nouvel horaire, en UTC (ISO 8601)',
    example: '2026-09-01T10:00:00.000Z',
  })
  @IsDateString()
  startAt!: string;
}