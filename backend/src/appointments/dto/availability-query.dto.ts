import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsISO8601, Matches } from 'class-validator';

// Paramètres de `GET /appointments/availability`.
//
// Ils arrivaient bruts, sans DTO : une valeur malformée traversait jusqu'à
// Prisma et ressortait en erreur technique. C'est en plus la seule route
// publique du projet — donc la seule qu'on puisse pousser sans compte.
export class AvailabilityQueryDto {
  @ApiProperty({
    description: 'Identifiant de la prestation',
    example: '63965408-ce9c-4f3f-9052-906538890053',
  })
  @IsUUID(undefined, {
    message: 'serviceId doit être un identifiant valide.',
  })
  serviceId!: string;

  @ApiProperty({
    description: 'Jour demandé (AAAA-MM-JJ, heure locale du centre)',
    example: '2026-08-31',
  })
  // Le service compose `${date}T12:00:00.000Z` : une date-heure complète
  // produirait une chaîne invalide. D'où la forme stricte jour seul.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date doit être au format AAAA-MM-JJ.',
  })
  // Et le contrôle de réalité par-dessus : le motif seul laisserait passer
  // 2026-02-31, que `new Date` déplacerait silencieusement au 3 mars — donc
  // une réponse fausse plutôt qu'un refus.
  @IsISO8601({ strict: true }, { message: 'date doit être un jour réel.' })
  date!: string;
}
