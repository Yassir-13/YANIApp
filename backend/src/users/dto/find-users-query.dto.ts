import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FindUsersQueryDto extends PaginationQueryDto {
  // Filtre serveur : avec la pagination, filtrer côté client ne porterait
  // que sur la page affichée et donnerait des résultats faux.
  @ApiPropertyOptional({ enum: Role, description: 'Ne renvoyer que ce rôle.' })
  @IsOptional()
  @IsEnum(Role, { message: 'role doit valoir CLIENT, STAFF ou ADMIN.' })
  role?: Role;

  @ApiPropertyOptional({
    example: 'Benali',
    description: 'Recherche sur le nom, le prénom, l’email ou le téléphone.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
