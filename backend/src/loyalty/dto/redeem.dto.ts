import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RedeemDto {
  @ApiProperty({ description: 'Récompense à échanger contre des points' })
  @IsUUID()
  rewardId!: string;
}