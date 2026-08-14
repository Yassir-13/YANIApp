import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateHoursDto, OpeningRangeDto } from './dto/update-hours.dto';
import { CreateClosureDto } from './dto/create-closure.dto';

@Injectable()
export class OpeningHoursService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────
  //  Horaires hebdomadaires
  // ─────────────────────────────────────────

  // Lecture publique. Un jour absent de cette liste est fermé : il n'y a plus
  // de ligne « fermée » à interpréter.
  findAll() {
    return this.prisma.openingHours.findMany({
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  // Admin : redéfinit ENTIÈREMENT les plages d'un jour.
  //
  // Remplacement et non fusion : la page envoie l'état complet du jour, ce qui
  // évite d'avoir à identifier chaque plage pour la modifier ou la supprimer.
  // Une liste vide ferme le jour.
  async setForDay(dto: UpdateHoursDto) {
    const ranges = this.assertCoherent(dto.ranges);

    return this.prisma.$transaction(async (tx) => {
      await tx.openingHours.deleteMany({ where: { dayOfWeek: dto.dayOfWeek } });
      if (ranges.length > 0) {
        await tx.openingHours.createMany({
          data: ranges.map((r) => ({
            dayOfWeek: dto.dayOfWeek,
            startTime: r.startTime,
            endTime: r.endTime,
          })),
        });
      }
      return tx.openingHours.findMany({
        where: { dayOfWeek: dto.dayOfWeek },
        orderBy: { startTime: 'asc' },
      });
    });
  }

  // Chaque plage doit se tenir, et deux plages du même jour ne peuvent pas se
  // chevaucher — sinon le moteur de créneaux proposerait deux fois la même
  // heure. Aucune contrainte SQL ne sait l'exprimer sans extension : c'est
  // donc ici, et nulle part ailleurs, que la règle est tenue.
  //
  // Les heures sont comparées comme des chaînes : « 09:00 » < « 12:00 » se
  // trie correctement tant que le format HH:MM est garanti, ce que fait le DTO.
  private assertCoherent(ranges: OpeningRangeDto[]): OpeningRangeDto[] {
    const triees = [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime));

    for (const [i, plage] of triees.entries()) {
      if (plage.startTime >= plage.endTime) {
        throw new BadRequestException(
          `Plage ${plage.startTime}–${plage.endTime} : le début doit précéder la fin.`,
        );
      }
      const suivante = triees[i + 1];
      if (suivante && suivante.startTime < plage.endTime) {
        throw new BadRequestException(
          `Les plages ${plage.startTime}–${plage.endTime} et ${suivante.startTime}–${suivante.endTime} se chevauchent.`,
        );
      }
    }

    return triees;
  }

  // ─────────────────────────────────────────
  //  Fermetures exceptionnelles
  // ─────────────────────────────────────────

  // Elles s'ajoutent aux horaires hebdomadaires et priment sur eux : un mardi
  // ouvert 9h-18h ne propose aucun créneau s'il tombe dans des congés.
  //
  // Les fermetures passées sont conservées : c'est un historique, et la page
  // les distingue à l'affichage.
  findClosures() {
    return this.prisma.closure.findMany({ orderBy: { startDate: 'asc' } });
  }

  async createClosure(dto: CreateClosureDto) {
    if (dto.startDate > dto.endDate) {
      throw new BadRequestException(
        'Le premier jour de fermeture doit précéder le dernier.',
      );
    }
    return this.prisma.closure.create({ data: dto });
  }

  async deleteClosure(id: string) {
    const closure = await this.prisma.closure.findUnique({ where: { id } });
    if (!closure) {
      throw new NotFoundException('Fermeture introuvable.');
    }
    return this.prisma.closure.delete({ where: { id } });
  }
}
