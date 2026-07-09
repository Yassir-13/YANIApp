import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'cliente@exemple.ma' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'motdepasse123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères.' })
  password!: string;

  @ApiPropertyOptional({ example: 'Sarah' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Benali' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '0612345678' })
  @IsOptional()
  @IsString()
  phone?: string;
}