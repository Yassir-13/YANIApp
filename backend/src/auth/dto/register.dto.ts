import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'cliente@exemple.ma' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'motdepasse123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères.' })
  password!: string;

  @ApiProperty({ example: 'Sarah' })
  @IsString()
  @MinLength(1, { message: 'Le prénom est obligatoire.' })
  @MaxLength(50, { message: 'Le prénom ne doit pas dépasser 50 caractères.' })
  firstName!: string;

  @ApiProperty({ example: 'Benali' })
  @IsString()
  @MinLength(1, { message: 'Le nom est obligatoire.' })
  @MaxLength(50, { message: 'Le nom ne doit pas dépasser 50 caractères.' })
  lastName!: string;

  @ApiProperty({ example: '0612345678' })
  @IsString()
  @Matches(/^(?:\+212|0)([5-7]\d{8})$/, {
    message: 'Le numéro de téléphone doit être un numéro marocain valide (ex. 0612345678 ou +212612345678).',
  })
  phone!: string;
}