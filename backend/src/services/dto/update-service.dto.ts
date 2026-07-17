import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsNumber, IsUUID, IsBoolean, Min,
} from 'class-validator';

// Mise à jour partielle d'une prestation : tous les champs sont optionnels.
// `active` permet de réactiver une prestation précédemment désactivée.
export class UpdateServiceDto {
  @ApiPropertyOptional({ example: '18f3dba9-c712-4fb1-92e8-0641ea599dee' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Brushing' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 'Brushing complet avec produits premium' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 45, description: 'Durée en minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMin?: number;

  @ApiPropertyOptional({ example: 150.0, description: 'Prix en dirhams' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'https://exemple.ma/images/brushing.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: true, description: 'Réactiver ou désactiver la prestation' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}