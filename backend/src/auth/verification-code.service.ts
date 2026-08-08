import { BadRequestException, Injectable } from '@nestjs/common';
import { VerificationPurpose } from '@prisma/client';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// Durée de vie d'un code. Assez long pour aller chercher son téléphone et
// fouiller ses spams, assez court pour qu'un code intercepté ne serve plus.
export const CODE_TTL_MINUTES = 15;

// 6 chiffres = 1 000 000 de combinaisons. Sans plafond, un script les épuise
// en quelques minutes. Avec 5 essais par code, une tentative aveugle a une
// chance sur 200 000 d'aboutir — et il faut redemander un code pour réessayer,
// ce que le délai ci-dessous limite à son tour.
export const MAX_CODE_ATTEMPTS = 5;

// Délai minimum entre deux envois pour un même usage. Empêche de noyer une
// boîte mail en appuyant en boucle sur « renvoyer ».
export const RESEND_COOLDOWN_SECONDS = 60;

const CODE_LENGTH = 6;

@Injectable()
export class VerificationCodeService {
  constructor(private readonly prisma: PrismaService) {}

  // randomInt (et non Math.random) : uniforme et imprévisible. Math.random est
  // prédictible à partir de quelques tirages, ce qui suffirait à deviner les
  // codes suivants sans jamais toucher à la boîte mail de la cliente.
  private generateCode(): string {
    return randomInt(0, 10 ** CODE_LENGTH)
      .toString()
      .padStart(CODE_LENGTH, '0');
  }

  // SHA-256, comme pour les refresh tokens.
  //
  // Soyons lucides sur ce que cela protège : un code à 6 chiffres n'a que
  // 1 000 000 de valeurs possibles, donc qui obtient une copie de la base
  // retrouve les codes en cours instantanément. Le hachage sert ici à ne pas
  // laisser traîner de code en clair dans une sauvegarde ou un export, pas à
  // résister à un attaquant qui lit déjà la base — celui-là peut de toute
  // façon modifier directement le mot de passe. La vraie protection reste la
  // durée de vie de 15 minutes, l'usage unique et le plafond de tentatives.
  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  // Émet un code et renvoie sa version en clair, à envoyer par email.
  //
  // Renvoie null si un code a déjà été émis il y a moins d'une minute :
  // l'appelant répond alors normalement sans rien envoyer. Refuser
  // explicitement révélerait l'existence du compte sur les routes publiques.
  async issue(
    userId: string,
    purpose: VerificationPurpose,
  ): Promise<string | null> {
    const existing = await this.prisma.verificationCode.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const secondsSince = (Date.now() - existing.createdAt.getTime()) / 1000;
      if (secondsSince < RESEND_COOLDOWN_SECONDS) {
        return null;
      }
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    // Les deux opérations sont atomiques : jamais deux codes valides en
    // parallèle pour un même usage, jamais d'instant sans aucun code alors
    // qu'un email vient de partir.
    await this.prisma.$transaction([
      this.prisma.verificationCode.deleteMany({ where: { userId, purpose } }),
      this.prisma.verificationCode.create({
        data: { userId, purpose, codeHash: this.hash(code), expiresAt },
      }),
    ]);

    return code;
  }

  // Valide un code et le consomme. Lève une erreur explicite sinon.
  //
  // La recherche se fait par (userId, purpose) et jamais par le hash du code :
  // à 6 chiffres, un code deviné correspondrait sinon au code en cours de
  // n'importe quelle autre cliente.
  async consume(
    userId: string,
    purpose: VerificationPurpose,
    submittedCode: string,
  ): Promise<void> {
    const record = await this.prisma.verificationCode.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.consumedAt) {
      throw new BadRequestException('Code invalide ou expiré.');
    }

    if (record.attempts >= MAX_CODE_ATTEMPTS) {
      throw new BadRequestException(
        'Trop de tentatives sur ce code. Demandez-en un nouveau.',
      );
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Ce code a expiré. Demandez-en un nouveau.');
    }

    if (!this.matches(record.codeHash, submittedCode)) {
      // L'incrément doit être persisté avant de refuser, sinon le plafond ne
      // compte rien : chaque tentative repartirait de zéro.
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Code invalide ou expiré.');
    }

    // Usage unique : marqué consommé, un rejeu ne vaudra plus rien.
    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
  }

  // Comparaison à durée constante : une comparaison classique s'arrête au
  // premier caractère différent, et cet écart de quelques microsecondes suffit
  // à reconstituer le code chiffre par chiffre au lieu de le deviner d'un bloc.
  private matches(storedHash: string, submittedCode: string): boolean {
    const submitted = Buffer.from(this.hash(submittedCode), 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    return (
      submitted.length === stored.length && timingSafeEqual(submitted, stored)
    );
  }
}
