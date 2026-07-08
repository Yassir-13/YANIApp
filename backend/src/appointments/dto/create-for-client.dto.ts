import { IsUUID, IsDateString } from 'class-validator';

export class CreateForClientDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  serviceId!: string;

  @IsDateString()
  startAt!: string;
}