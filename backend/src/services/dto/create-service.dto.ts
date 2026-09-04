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

  // Facultative, et sans aucun effet sur les réservations : le moteur de
  // créneaux ne la lit plus. Le centre espace ses rendez-vous d'un écart fixe,
  // réglé dans les paramètres — voir appointments.service.ts. Cette valeur ne
  // sert qu'à la gestion interne, dans le backoffice.
  @ApiPropertyOptional({
    example: 45,
    description:
      "Durée indicative en minutes. N'intervient PAS dans le calcul des créneaux.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMin?: number;

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