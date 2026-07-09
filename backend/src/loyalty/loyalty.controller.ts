import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { RedeemDto } from './dto/redeem.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('loyalty')
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  // ----- CLIENT -----

  @Get('me')
  getMyAccount(@Req() req: any) {
    return this.loyaltyService.getAccount(req.user.id);
  }

  @Get('me/history')
  getMyHistory(@Req() req: any) {
    return this.loyaltyService.getHistory(req.user.id);
  }

  // Catalogue des récompenses disponibles
  @Get('rewards')
  findRewards() {
    return this.loyaltyService.findActiveRewards();
  }

  // Échanger des points contre une récompense
  @Post('redeem')
  redeem(@Req() req: any, @Body() dto: RedeemDto) {
    return this.loyaltyService.redeem(req.user.id, dto.rewardId);
  }

  // ----- ADMIN -----

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('rewards/all')
  findAllRewards() {
    return this.loyaltyService.findAllRewards();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post('rewards')
  createReward(@Body() dto: CreateRewardDto) {
    return this.loyaltyService.createReward(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete('rewards/:id')
  deactivateReward(@Param('id', ParseUUIDPipe) id: string) {
    return this.loyaltyService.deactivateReward(id);
  }
}