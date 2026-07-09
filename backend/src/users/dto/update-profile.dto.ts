import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Sarah' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Benali' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({ example: '0612345678' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}