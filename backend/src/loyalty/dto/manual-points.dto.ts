import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsInt, Min, Max, IsOptional, IsString } from 'class-validator';

// Plafond par opération manuelle (anti-fraude)
export const MANUAL_POINTS_CAP = 100;

export class ManualPointsDto {
  @ApiProperty({ description: 'Client à créditer' })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    example: 20,
    maximum: MANUAL_POINTS_CAP,
    description: `Points à créditer (max ${MANUAL_POINTS_CAP})`,
  })
  @IsInt()
  @Min(1)
  @Max(MANUAL_POINTS_CAP, {
    message: `Un ajout manuel ne peut dépasser ${MANUAL_POINTS_CAP} points.`,
  })
  points!: number;

  @ApiPropertyOptional({ example: 'Geste commercial' })
  @IsOptional()
  @IsString()
  reason?: string;
}