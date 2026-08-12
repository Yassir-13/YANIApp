import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// Les onglets de la page Rendez-vous du backoffice. Ils vivaient côté
// navigateur, sur la liste complète téléchargée ; une fois la liste paginée,
// filtrer sur place ne porterait plus que sur la page affichée — donc
// donnerait des résultats faux. Même raison que le filtre de FindUsersQueryDto.
export enum AppointmentFilter {
  TODAY = 'TODAY',
  UPCOMING = 'UPCOMING',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ALL = 'ALL',
}

export class FindAppointmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: AppointmentFilter,
    description:
      'Vue demandée. TODAY et UPCOMING écartent les rendez-vous annulés.',
  })
  @IsOptional()
  @IsEnum(AppointmentFilter, {
    message: `filter doit valoir ${Object.values(AppointmentFilter).join(', ')}.`,
  })
  filter: AppointmentFilter = AppointmentFilter.ALL;
}
