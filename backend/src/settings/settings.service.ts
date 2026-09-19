import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

// Réglages de réservation du centre. Ils remplacent deux constantes qui
// vivaient dans le code du moteur de créneaux : ajouter une cabine demandait
// un redéploiement.
//
// Une seule ligne, d'identifiant 1. Elle est créée par la migration ; le repli
// ci-dessous existe pour qu'une base restaurée d'un dump incomplet ne fasse
// pas tomber la réservation.
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // `db` : le client de la transaction appelante, quand il y en a une.
  //
  // Sans lui, cette lecture réclamait une connexion SUPPLÉMENTAIRE au pool
  // alors que la transaction appelante en détenait déjà une, et ne la rendrait
  // qu'à son commit. Prisma ouvre `cœurs × 2 + 1` connexions : sur une machine
  // à deux cœurs, cinq réservations simultanées prenaient les cinq, puis
  // attendaient toutes une sixième que seule leur propre fin aurait libérée.
  // La réservation rendait alors une erreur de pool opaque au bout de 10 s,
  // au lieu du « Ce créneau est complet » attendu.
  async get(db: Prisma.TransactionClient = this.prisma) {
    const settings = await db.centerSettings.findUnique({
      where: { id: 1 },
    });
    return settings ?? db.centerSettings.create({ data: { id: 1 } });
  }

  update(dto: UpdateSettingsDto) {
    return this.prisma.centerSettings.upsert({
      where: { id: 1 },
      update: dto,
      create: { id: 1, ...dto },
    });
  }
}
