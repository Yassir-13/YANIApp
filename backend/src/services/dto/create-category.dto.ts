import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateServiceCategoryDto {
  @ApiProperty({ example: 'Coiffure' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

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
}