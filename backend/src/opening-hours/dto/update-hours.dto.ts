import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  Min,
  Max,
  Matches,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class OpeningRangeDto {
  @ApiProperty({ example: '09:00', description: "Début de la plage (heure locale)" })
  @Matches(HHMM, {
    message: 'startTime doit être au format HH:MM (ex : 09:00).',
  })
  startTime!: string;

  @ApiProperty({ example: '12:00', description: 'Fin de la plage (heure locale)' })
  @Matches(HHMM, {
    message: 'endTime doit être au format HH:MM (ex : 12:00).',
  })
  endTime!: string;
}

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

  // Une liste VIDE ferme le jour : c'est ce qui a remplacé l'ancien booléen
  // `isClosed`. Le plafond n'est pas une contrainte métier mais une borne :
  // sans lui, une requête pourrait demander mille plages pour un mardi.
  @ApiProperty({
    type: [OpeningRangeDto],
    description: 'Plages du jour. Liste vide = jour fermé.',
  })
  @IsArray()
  @ArrayMaxSize(6, { message: 'Six plages par jour au maximum.' })
  @ValidateNested({ each: true })
  @Type(() => OpeningRangeDto)
  ranges!: OpeningRangeDto[];
}
