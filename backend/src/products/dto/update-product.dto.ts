import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsNumber, IsUUID, IsBoolean, Min,
} from 'class-validator';

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
  name?: string;

  @ApiPropertyOptional({ example: 'Masque nourrissant aux huiles naturelles' })
  @IsOptional()
  @IsString()
  description?: string;

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

  @ApiPropertyOptional({ example: 'https://exemple.ma/images/masque.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: true, description: 'Réactiver ou désactiver le produit' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}