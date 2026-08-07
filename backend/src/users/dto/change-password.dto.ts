import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import {
  IsAppPassword,
  PASSWORD_MIN_LENGTH,
} from '../../common/validators/password.validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mot de passe actuel (vérification obligatoire)' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({
    minLength: PASSWORD_MIN_LENGTH,
    description:
      'Au moins 8 caractères, dont une majuscule et une minuscule — ' +
      'mêmes règles qu’à l’inscription.',
  })
  @IsAppPassword()
  newPassword!: string;
}
