import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import {
  IsAppPassword,
  PASSWORD_MIN_LENGTH,
} from '../../common/validators/password.validator';
import { IsMoroccanPhone } from '../../common/validators/phone.validator';

export class RegisterDto {
  @ApiProperty({ example: 'cliente@exemple.ma' })
  @IsEmail({}, { message: 'Adresse email invalide.' })
  email!: string;

  @ApiProperty({
    example: 'MonMotDePasse',
    minLength: PASSWORD_MIN_LENGTH,
    description: 'Au moins 8 caractères, dont une majuscule et une minuscule.',
  })
  @IsAppPassword()
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
  @IsMoroccanPhone()
  phone!: string;

  @ApiPropertyOptional({
    example: 'ar',
    enum: ['fr', 'ar', 'en'],
    description:
      "Langue des EMAILS de la cliente. Les réponses de l'API, elles, suivent l'en-tête Accept-Language de chaque requête.",
  })
  @IsOptional()
  @IsIn(['fr', 'ar', 'en'], { message: 'locale doit valoir fr, ar ou en.' })
  locale?: string;
}
