import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { AppointmentStatus, OrderStatus, Role } from '@prisma/client';

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

// Bornes de l'export, exprimées en JOURS DU CENTRE (« 2026-08-01 ») et non en
// instants UTC : le bilan du mois d'août doit contenir la commande du 31 août
// à 23 h, qui est déjà le 1er septembre pour un serveur en UTC. Le service
// traduit ensuite chaque borne en instant, dans le fuseau du centre.
//
// Les deux bornes sont facultatives : sans elles, l'export porte sur tout
// depuis l'ouverture.
export class ExportRangeDto {
  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'Premier jour inclus (AAAA-MM-JJ)',
  })
  @IsOptional()
  @Matches(JOUR, {
    message: 'La date de début doit être au format AAAA-MM-JJ.',
  })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-08-31',
    description: 'Dernier jour inclus (AAAA-MM-JJ)',
  })
  @IsOptional()
  @Matches(JOUR, { message: 'La date de fin doit être au format AAAA-MM-JJ.' })
  to?: string;
}

export class ExportUsersQueryDto extends ExportRangeDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role, { message: 'Rôle inconnu.' })
  role?: Role;
}

export class ExportOrdersQueryDto extends ExportRangeDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'Statut de commande inconnu.' })
  status?: OrderStatus;
}

export class ExportAppointmentsQueryDto extends ExportRangeDto {
  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus, { message: 'Statut de rendez-vous inconnu.' })
  status?: AppointmentStatus;
}
