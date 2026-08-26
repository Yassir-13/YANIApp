import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateProductCategoryDto {
  @ApiProperty({ example: 'Soins capillaires' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}