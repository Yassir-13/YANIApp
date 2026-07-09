import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    description: 'Refresh token obtenu au login',
    example: '36dae84a1de81f23a06d7ed352e9af27...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}