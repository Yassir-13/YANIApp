import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import {
  IsAppPassword,
  PASSWORD_MIN_LENGTH,
} from '../../common/validators/password.validator';
import { IsVerificationCode } from '../../common/validators/verification-code.validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'cliente@exemple.ma' })
  @IsEmail({}, { message: 'Adresse email invalide.' })
  email!: string;

  @ApiProperty({ example: '482913', description: 'Code reçu par email.' })
  @IsVerificationCode()
  code!: string;

  @ApiProperty({
    minLength: PASSWORD_MIN_LENGTH,
    description:
      'Au moins 8 caractères, dont une majuscule et une minuscule — ' +
      'mêmes règles qu’à l’inscription.',
  })
  @IsAppPassword()
  newPassword!: string;
}
