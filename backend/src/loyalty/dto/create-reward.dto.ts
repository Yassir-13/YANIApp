import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateRewardDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  pointsCost!: number;
}