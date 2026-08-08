import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'cliente@exemple.ma' })
  @IsEmail({}, { message: 'Adresse email invalide.' })
  email!: string;
}
