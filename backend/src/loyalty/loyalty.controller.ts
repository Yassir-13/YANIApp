import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('loyalty')
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  // Mon solde de points
  @Get('me')
  getMyAccount(@Req() req: any) {
    return this.loyaltyService.getAccount(req.user.id);
  }

  // Mon historique de transactions
  @Get('me/history')
  getMyHistory(@Req() req: any) {
    return this.loyaltyService.getHistory(req.user.id);
  }
}