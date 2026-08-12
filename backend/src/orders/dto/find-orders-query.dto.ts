import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FindOrdersQueryDto extends PaginationQueryDto {
  // `@Query('status') status?: OrderStatus` annonçait un type TypeScript, qui
  // disparaît à la compilation et ne valide donc rien à l'exécution : une
  // valeur inventée arrivait telle quelle jusqu'à Prisma.
  @ApiPropertyOptional({
    enum: OrderStatus,
    description: 'Ne renvoyer que les commandes dans ce statut.',
  })
  @IsOptional()
  @IsEnum(OrderStatus, {
    message: `status doit valoir ${Object.values(OrderStatus).join(', ')}.`,
  })
  status?: OrderStatus;
}
