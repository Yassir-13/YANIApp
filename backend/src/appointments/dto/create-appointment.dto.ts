import { IsUUID, IsDateString } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  serviceId!: string;

  @IsDateString()
  startAt!: string;
}