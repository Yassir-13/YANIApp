import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: '488ec126-3bea-423d-88c1-d282e9210d62' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'Masque hydratant' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Masque nourrissant aux huiles naturelles' })
  @IsOptional()
  @IsString()
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

  @ApiPropertyOptional({ example: 'https://exemple.ma/images/masque.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}