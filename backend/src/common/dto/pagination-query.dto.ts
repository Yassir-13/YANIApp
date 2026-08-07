import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Valeurs par défaut, partagées par les endpoints paginés.
export const DEFAULT_PAGE_SIZE = 25;
// Plafond dur : empêche un client de demander 100 000 lignes d'un coup
// (une requête pareille suffirait à saturer la base).
export const MAX_PAGE_SIZE = 100;

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, description: 'Page demandée (1 = première)' })
  @IsOptional()
  @Type(() => Number) // les query params arrivent en chaîne : on convertit
  @IsInt({ message: 'page doit être un entier.' })
  @Min(1, { message: 'page commence à 1.' })
  page: number = 1;

  @ApiPropertyOptional({
    example: DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    description: `Nombre d'éléments par page (max ${MAX_PAGE_SIZE})`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit doit être un entier.' })
  @Min(1, { message: 'limit vaut au minimum 1.' })
  @Max(MAX_PAGE_SIZE, { message: `limit ne peut dépasser ${MAX_PAGE_SIZE}.` })
  limit: number = DEFAULT_PAGE_SIZE;
}

// Enveloppe de réponse commune à tous les endpoints paginés.
// `total` est indispensable côté client pour afficher « page 2 sur 7 » :
// sans lui, l'interface ne peut pas savoir s'il reste des pages.
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
