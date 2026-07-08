import { IsInt, IsString, IsBoolean, IsOptional, Min, Max, Matches } from 'class-validator';

export class UpdateHoursDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'openTime doit être au format HH:MM (ex : 09:00).',
  })
  openTime!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'closeTime doit être au format HH:MM (ex : 19:00).',
  })
  closeTime!: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}