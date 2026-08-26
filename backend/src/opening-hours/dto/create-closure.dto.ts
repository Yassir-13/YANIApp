import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Jour du calendrier local du centre, pas un instant : le mois et le quantième
// sont bornés ici pour qu'une date impossible n'atteigne jamais la base.
//
// Le motif borne le mois et le quantième, mais il ne connaît pas les mois : il
// laissait passer le 31 février. D'où le contrôle de réalité qui l'accompagne
// désormais sur chaque borne, comme dans AvailabilityQueryDto.
const DATE_ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class CreateClosureDto {
  @ApiProperty({ example: '2026-08-20', description: 'Premier jour fermé (AAAA-MM-JJ)' })
  @Matches(DATE_ISO, {
    message: 'startDate doit être une date au format AAAA-MM-JJ.',
  })
  @IsISO8601({ strict: true }, { message: 'startDate doit être un jour réel.' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-27', description: 'Dernier jour fermé, inclus' })
  @Matches(DATE_ISO, {
    message: 'endDate doit être une date au format AAAA-MM-JJ.',
  })
  @IsISO8601({ strict: true }, { message: 'endDate doit être un jour réel.' })
  endDate!: string;

  @ApiPropertyOptional({ example: 'Congés annuels' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;
}
