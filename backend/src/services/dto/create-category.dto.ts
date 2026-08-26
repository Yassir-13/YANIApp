import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateServiceCategoryDto {
  @ApiProperty({ example: 'Coiffure' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}