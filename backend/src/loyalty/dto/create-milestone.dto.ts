import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsInt, Min, Max, IsOptional, IsBoolean } from 'class-validator';

// Garde-fou : un seuil trop bas offrirait une récompense à presque chaque
// passage, un seuil absurde la rendrait inatteignable.
export const MIN_VISIT_THRESHOLD = 2;
export const MAX_VISIT_THRESHOLD = 100;

export class CreateMilestoneDto {
  @ApiProperty({
    example: 10,
    minimum: MIN_VISIT_THRESHOLD,
    maximum: MAX_VISIT_THRESHOLD,
    description: 'Nombre de visites qui déclenche la récompense',
  })
  @IsInt()
  @Min(MIN_VISIT_THRESHOLD, {
    message: `Un palier doit valoir au moins ${MIN_VISIT_THRESHOLD} visites.`,
  })
  @Max(MAX_VISIT_THRESHOLD, {
    message: `Un palier ne peut dépasser ${MAX_VISIT_THRESHOLD} visites.`,
  })
  visitThreshold!: number;

  @ApiProperty({ description: 'Récompense du catalogue offerte au palier' })
  @IsUUID()
  rewardId!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Rejouer le palier à chaque multiple du seuil (10e, 20e, 30e…)',
  })
  @IsOptional()
  @IsBoolean()
  recurring?: boolean;
}
