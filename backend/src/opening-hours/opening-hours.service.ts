import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateHoursDto } from './dto/update-hours.dto';

@Injectable()
export class OpeningHoursService {
  constructor(private readonly prisma: PrismaService) {}

  // Lecture publique : l'app affiche les horaires du centre
  findAll() {
    return this.prisma.openingHours.findMany({
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  // Admin : définit ou met à jour les horaires d'un jour (upsert)
  async setForDay(dto: UpdateHoursDto) {
    // Cohérence : l'ouverture doit précéder la fermeture (sauf jour fermé)
    if (!dto.isClosed && dto.openTime >= dto.closeTime) {
      throw new BadRequestException(
        "L'heure d'ouverture doit précéder l'heure de fermeture.",
      );
    }

    return this.prisma.openingHours.upsert({
      where: { dayOfWeek: dto.dayOfWeek },
      update: {
        openTime: dto.openTime,
        closeTime: dto.closeTime,
        isClosed: dto.isClosed ?? false,
      },
      create: {
        dayOfWeek: dto.dayOfWeek,
        openTime: dto.openTime,
        closeTime: dto.closeTime,
        isClosed: dto.isClosed ?? false,
      },
    });
  }
}