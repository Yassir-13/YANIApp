import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class UpdateHoursDto {
  @ApiProperty({
    example: 1,
    minimum: 0,
    maximum: 6,
    description: '0 = dimanche, 1 = lundi, ... 6 = samedi',
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '09:00', description: "Heure d'ouverture (locale)" })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'openTime doit être au format HH:MM (ex : 09:00).',
  })
  openTime!: string;

  @ApiProperty({ example: '19:00', description: 'Heure de fermeture (locale)' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'closeTime doit être au format HH:MM (ex : 19:00).',
  })
  closeTime!: string;

  @ApiPropertyOptional({ example: false, description: 'Jour de fermeture' })
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}