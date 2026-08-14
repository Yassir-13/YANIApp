import { Injectable } from '@nestjs/common';
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

  async get() {
    const settings = await this.prisma.centerSettings.findUnique({
      where: { id: 1 },
    });
    return settings ?? this.prisma.centerSettings.create({ data: { id: 1 } });
  }

  update(dto: UpdateSettingsDto) {
    return this.prisma.centerSettings.upsert({
      where: { id: 1 },
      update: dto,
      create: { id: 1, ...dto },
    });
  }
}
