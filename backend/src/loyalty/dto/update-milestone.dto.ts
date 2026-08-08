import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsInt, Min, Max, IsOptional, IsBoolean } from 'class-validator';
import { MIN_VISIT_THRESHOLD, MAX_VISIT_THRESHOLD } from './create-milestone.dto';

// Mise à jour partielle d'un palier : tous les champs sont optionnels.
// Modifier le seuil ou la récompense n'affecte que les prochains déblocages —
// les récompenses déjà offertes gardent celle qui a été figée à l'époque.
export class UpdateMilestoneDto {
  @ApiPropertyOptional({
    example: 10,
    minimum: MIN_VISIT_THRESHOLD,
    maximum: MAX_VISIT_THRESHOLD,
    description: 'Nombre de visites qui déclenche la récompense',
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_VISIT_THRESHOLD, {
    message: `Un palier doit valoir au moins ${MIN_VISIT_THRESHOLD} visites.`,
  })
  @Max(MAX_VISIT_THRESHOLD, {
    message: `Un palier ne peut dépasser ${MAX_VISIT_THRESHOLD} visites.`,
  })
  visitThreshold?: number;

  @ApiPropertyOptional({ description: 'Récompense du catalogue offerte au palier' })
  @IsOptional()
  @IsUUID()
  rewardId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Rejouer le palier à chaque multiple du seuil (10e, 20e, 30e…)',
  })
  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Activer ou désactiver le palier' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
