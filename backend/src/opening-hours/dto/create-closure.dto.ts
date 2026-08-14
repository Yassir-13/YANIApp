import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// Jour du calendrier local du centre, pas un instant : le mois et le quantième
// sont bornés ici pour qu'une date impossible n'atteigne jamais la base.
const DATE_ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class CreateClosureDto {
  @ApiProperty({ example: '2026-08-20', description: 'Premier jour fermé (AAAA-MM-JJ)' })
  @Matches(DATE_ISO, {
    message: 'startDate doit être une date au format AAAA-MM-JJ.',
  })
  startDate!: string;

  @ApiProperty({ example: '2026-08-27', description: 'Dernier jour fermé, inclus' })
  @Matches(DATE_ISO, {
    message: 'endDate doit être une date au format AAAA-MM-JJ.',
  })
  endDate!: string;

  @ApiPropertyOptional({ example: 'Congés annuels' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;
}
