import { ApiProperty } from '@nestjs/swagger';
import { IsVerificationCode } from '../../common/validators/verification-code.validator';

export class VerifyEmailDto {
  @ApiProperty({ example: '482913', description: 'Code reçu par email.' })
  @IsVerificationCode()
  code!: string;
}
