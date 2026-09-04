import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, MaxLength, Min,
} from 'class-validator';

// Mise à jour partielle d'une récompense : tous les champs sont optionnels.
// `active` permet de réactiver une récompense précédemment retirée du catalogue.
export class UpdateRewardDto {
  @ApiPropertyOptional({ example: 'Soin visage offert' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Un soin complet du visage' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  // ── Traductions ──
  // Facultatives, et c'est le principe : une case vide veut dire « pas encore
  // traduit », l'API sert alors le français et la fiche reste lisible.
  @ApiPropertyOptional({ description: "Nom en arabe. Vide = servi en français." })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameAr?: string | null;

  @ApiPropertyOptional({ description: "Nom en anglais. Vide = servi en français." })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameEn?: string | null;

  @ApiPropertyOptional({ description: "Description en arabe. Vide = servie en français." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionAr?: string | null;

  @ApiPropertyOptional({ description: "Description en anglais. Vide = servie en français." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionEn?: string | null;

  @ApiPropertyOptional({ example: 300, description: 'Coût en points' })
  @IsOptional()
  @IsInt()
  @Min(1)
  pointsCost?: number;

  @ApiPropertyOptional({ example: true, description: 'Réactiver ou retirer la récompense' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
