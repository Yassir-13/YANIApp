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

  @ApiPropertyOptional({ example: '0612345678' })
  @IsOptional()
  @IsMoroccanPhone()
  phone?: string;
}
