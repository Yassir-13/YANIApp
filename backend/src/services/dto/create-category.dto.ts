import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateServiceCategoryDto {
  @ApiProperty({ example: 'Coiffure' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}