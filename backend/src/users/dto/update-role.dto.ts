import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateRoleDto {
  @ApiProperty({
    enum: Role,
    example: Role.STAFF,
    description:
      'Le rôle ADMIN est unique : impossible d’en créer un second, ni de rétrograder le seul existant.',
  })
  @IsEnum(Role)
  role!: Role;
}