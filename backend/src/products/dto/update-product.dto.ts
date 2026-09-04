import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsNumber, IsUUID, IsBoolean,
  Matches, MaxLength, Min,
} from 'class-validator';
import { UPLOADED_IMAGE_PATH } from '../../uploads/uploads.config';

// Mise à jour partielle d'un produit : tous les champs sont optionnels.
// `active` permet de réactiver un produit précédemment désactivé.
export class UpdateProductDto {
  @ApiPropertyOptional({ example: '488ec126-3bea-423d-88c1-d282e9210d62' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Masque hydratant' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Masque nourrissant aux huiles naturelles' })
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

  @ApiPropertyOptional({ example: 89.9, description: 'Prix en dirhams' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 25, description: 'Quantité en stock (réapprovisionnement)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  // Chemin renvoyé par POST /uploads/image, et rien d'autre : les images sont
  // hébergées par l'API, plus par un site tiers. Voir UPLOADED_IMAGE_PATH pour
  // la raison du chemin relatif.
  @ApiPropertyOptional({ example: '/uploads/3f2e1d0c-9b8a-4756-8432-1a2b3c4d5e6f.webp' })
  @IsOptional()
  @Matches(UPLOADED_IMAGE_PATH, {
    message: "imageUrl doit être un chemin renvoyé par POST /uploads/image.",
  })
  // `null` accepté, et pas seulement `undefined` : c'est ce qui permet de
  // RETIRER une photo. `undefined` disparaît du JSON, la colonne garderait donc
  // l'ancienne valeur. @IsOptional() laisse passer les deux.
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: true, description: 'Réactiver ou désactiver le produit' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}