import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  IsUUID,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

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

  // L'adresse part directement dans un `<img src>` de l'app et du backoffice.
  // Le protocole est exigé : sans lui, « exemple.ma/img.jpg » passait la
  // validation et n'affichait rien.
  @ApiPropertyOptional({ example: 'https://exemple.ma/images/brushing.jpg' })
  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: "imageUrl doit être une adresse http(s) complète." },
  )
  imageUrl?: string;
}