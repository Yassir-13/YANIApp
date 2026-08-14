import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsIn, Min, Max } from 'class-validator';

// Écarts proposés. Une valeur libre n'aurait pas de sens au comptoir (un
// créneau toutes les sept minutes) et un écart minuscule ferait exploser la
// liste renvoyée par le moteur de disponibilité.
export const ECARTS_AUTORISES = [15, 20, 30, 45, 60];

export class UpdateSettingsDto {
  @ApiProperty({ example: 2, minimum: 1, maximum: 20, description: 'Cabines réservables par l’app' })
  @IsInt()
  @Min(1, { message: 'Le centre doit avoir au moins une cabine réservable.' })
  @Max(20)
  capacity!: number;

  @ApiProperty({ example: 30, enum: ECARTS_AUTORISES, description: 'Écart entre deux créneaux proposés (minutes)' })
  @IsInt()
  @IsIn(ECARTS_AUTORISES, {
    message: `L'écart entre créneaux doit valoir ${ECARTS_AUTORISES.join(', ')} minutes.`,
  })
  slotIntervalMin!: number;
}
