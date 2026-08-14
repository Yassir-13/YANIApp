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

export class CreateProductDto {
  @ApiProperty({ example: '488ec126-3bea-423d-88c1-d282e9210d62' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'Masque hydratant' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Masque nourrissant aux huiles naturelles' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 89.9, description: 'Prix en dirhams' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 25, description: 'Quantité en stock' })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  // L'adresse part directement dans un `<img src>` de l'app et du backoffice.
  // Le protocole est exigé : sans lui, « exemple.ma/img.jpg » passait la
  // validation et n'affichait rien.
  @ApiPropertyOptional({ example: 'https://exemple.ma/images/masque.jpg' })
  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: "imageUrl doit être une adresse http(s) complète." },
  )
  imageUrl?: string;
}