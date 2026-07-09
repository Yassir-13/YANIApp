import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateRewardDto {
  @ApiProperty({ example: 'Soin visage offert' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Un soin complet du visage' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 100, description: 'Coût en points' })
  @IsInt()
  @Min(1)
  pointsCost!: number;
}