import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateProductCategoryDto {
  @ApiProperty({ example: 'Soins capillaires' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}