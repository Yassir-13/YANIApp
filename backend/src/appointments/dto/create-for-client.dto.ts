import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsDateString } from 'class-validator';

export class CreateForClientDto {
  @ApiProperty({ description: 'Client pour lequel on réserve' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ example: '63965408-ce9c-4f3f-9052-906538890053' })
  @IsUUID()
  serviceId!: string;

  @ApiProperty({
    description: 'Début du rendez-vous, en UTC (ISO 8601)',
    example: '2026-08-31T09:30:00.000Z',
  })
  @IsDateString()
  startAt!: string;
}