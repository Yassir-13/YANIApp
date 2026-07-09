import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mot de passe actuel (vérification obligatoire)' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, {
    message: 'Le nouveau mot de passe doit faire au moins 8 caractères.',
  })
  newPassword!: string;
}