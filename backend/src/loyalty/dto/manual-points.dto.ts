import { IsUUID, IsInt, Min, Max, IsOptional, IsString } from 'class-validator';

// Plafond par opération manuelle (anti-fraude)
export const MANUAL_POINTS_CAP = 100;

export class ManualPointsDto {
  @IsUUID()
  userId!: string;

  @IsInt()
  @Min(1)
  @Max(MANUAL_POINTS_CAP, {
    message: `Un ajout manuel ne peut dépasser ${MANUAL_POINTS_CAP} points.`,
  })
  points!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}