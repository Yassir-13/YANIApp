import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { UPLOADED_IMAGE_PATH } from '../../uploads/uploads.config';

export class CreateServiceDto {
  @ApiProperty({ example: '18f3dba9-c712-4fb1-92e8-0641ea599dee' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'Brushing' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Brushing complet avec produits premium' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 45, description: 'Durée en minutes' })
  @IsInt()
  @Min(1)
  durationMin!: number;

  @ApiProperty({ example: 150.0, description: 'Prix en dirhams' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  // Chemin renvoyé par POST /uploads/image, et rien d'autre : les images sont
  // hébergées par l'API, plus par un site tiers. Voir UPLOADED_IMAGE_PATH pour
  // la raison du chemin relatif.
  @ApiPropertyOptional({ example: '/uploads/9c8b7a65-4321-4fed-9876-0a1b2c3d4e5f.webp' })
  @IsOptional()
  @Matches(UPLOADED_IMAGE_PATH, {
    message: "imageUrl doit être un chemin renvoyé par POST /uploads/image.",
  })
  imageUrl?: string;
}