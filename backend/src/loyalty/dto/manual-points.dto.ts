import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Plafond par opération manuelle (anti-fraude)
export const MANUAL_POINTS_CAP = 100;

// Doit rester aligné sur @db.VarChar(255) de LoyaltyTransaction.reason,
// sinon un motif trop long remonterait en erreur Postgres brute (500).
export const REASON_MAX_LENGTH = 255;

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

  @ApiPropertyOptional({
    example: 'Geste commercial',
    maxLength: REASON_MAX_LENGTH,
    description: "Motif du crédit, conservé pour l'audit.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(REASON_MAX_LENGTH, {
    message: `Le motif ne doit pas dépasser ${REASON_MAX_LENGTH} caractères.`,
  })
  reason?: string;
}