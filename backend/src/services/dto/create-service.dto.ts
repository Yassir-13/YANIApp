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

export class CreateServiceDto {
  @ApiProperty({ example: '18f3dba9-c712-4fb1-92e8-0641ea599dee' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'Brushing' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Brushing complet avec produits premium' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 45, description: 'Durée en minutes' })
  @IsInt()
  @Min(1)
  durationMin!: number;

  @ApiProperty({ example: 150.0, description: 'Prix en dirhams' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 'https://exemple.ma/images/brushing.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}