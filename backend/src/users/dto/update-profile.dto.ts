import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsMoroccanPhone } from '../../common/validators/phone.validator';

// Mise à jour partielle du profil : chaque champ est optionnel, mais s'il est
// fourni il doit respecter les MÊMES règles qu'à l'inscription. Sans cela, on
// pouvait s'inscrire avec des données valides puis les vider ou saisir un
// téléphone fantaisiste via le profil.
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Sarah' })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Le prénom ne peut pas être vide.' })
  @MaxLength(50, { message: 'Le prénom ne doit pas dépasser 50 caractères.' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Benali' })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Le nom ne peut pas être vide.' })
  @MaxLength(50, { message: 'Le nom ne doit pas dépasser 50 caractères.' })
  lastName?: string;

  // `null` est accepté et signifie « efface mon numéro ». Le champ est libellé
  // « (optionnel) » dans l'app : il doit donc pouvoir redevenir vide.
  // `@IsOptional()` laisse passer `null` sans le valider, et Prisma écrit
  // alors NULL. À ne pas confondre avec `undefined`, qui disparaît du JSON et
  // laisse donc l'ancien numéro en place — c'était précisément le défaut.
  @ApiPropertyOptional({ example: '0612345678', nullable: true })
  @IsOptional()
  @IsMoroccanPhone()
  phone?: string | null;
}
