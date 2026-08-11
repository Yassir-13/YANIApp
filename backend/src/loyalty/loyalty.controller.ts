import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { RedeemDto } from './dto/redeem.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ManualPointsDto } from './dto/manual-points.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('loyalty')
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

  // Paliers en vigueur : sert à afficher l'objectif de visites en cours
  @Get('milestones')
  findMilestones() {
    return this.loyaltyService.findActiveMilestones();
  }

  // Récompenses offertes débloquées par la cliente
  @Get('me/grants')
  getMyGrants(@Req() req: any) {
    return this.loyaltyService.getMyGrants(req.user.id);
  }

  // Réclamer une récompense offerte (aucun point dépensé)
  @Post('grants/:id/claim')
  claimGrant(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.loyaltyService.claimGrant(req.user.id, id);
  }

  // Les bons de la cliente : ce qu'elle a à présenter à l'institut, et ce
  // qu'elle a déjà utilisé.
  @Get('me/vouchers')
  getMyVouchers(@Req() req: any) {
    return this.loyaltyService.getMyVouchers(req.user.id);
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
  @Patch('rewards/:id')
  updateReward(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRewardDto,
  ) {
    return this.loyaltyService.updateReward(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete('rewards/:id')
  deactivateReward(@Param('id', ParseUUIDPipe) id: string) {
    return this.loyaltyService.deactivateReward(id);
  }

  // ----- ADMIN : paliers de visites -----

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('milestones/all')
  findAllMilestones() {
    return this.loyaltyService.findAllMilestones();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post('milestones')
  createMilestone(@Body() dto: CreateMilestoneDto) {
    return this.loyaltyService.createMilestone(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch('milestones/:id')
  updateMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.loyaltyService.updateMilestone(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete('milestones/:id')
  deactivateMilestone(@Param('id', ParseUUIDPipe) id: string) {
    return this.loyaltyService.deactivateMilestone(id);
  }

   // Consulter le compte fidélité d'un client (lecture au comptoir)
  @UseGuards(RolesGuard)
  @Roles('STAFF', 'ADMIN')
  @Get('accounts/:userId')
  getClientAccount(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.loyaltyService.getAccountByUserId(userId);
  }

  // Ajouter des points manuellement (tracé)
  @UseGuards(RolesGuard)
  @Roles('STAFF', 'ADMIN')
  @Post('manual')
  addManualPoints(@Req() req: any, @Body() dto: ManualPointsDto) {
    return this.loyaltyService.addManualPoints(dto, req.user.id);
  }

  // ----- STAFF/ADMIN : bons à honorer au comptoir -----
  //
  // Réservé au personnel mais PAS à l'admin seule : remettre une récompense
  // est le travail quotidien du comptoir, pas un acte de gestion.

  @UseGuards(RolesGuard)
  @Roles('STAFF', 'ADMIN')
  @Get('vouchers/pending')
  pendingVouchers() {
    return this.loyaltyService.listPendingVouchers();
  }

  @UseGuards(RolesGuard)
  @Roles('STAFF', 'ADMIN')
  @Get('vouchers/honored')
  honoredVouchers(@Query() query: PaginationQueryDto) {
    return this.loyaltyService.listHonoredVouchers(query);
  }

  @UseGuards(RolesGuard)
  @Roles('STAFF', 'ADMIN')
  @Post('vouchers/:id/honor')
  honorVoucher(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.loyaltyService.honorVoucher(id, req.user.id);
  }

  // ----- ADMIN uniquement : audit -----

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('audit/manual')
  auditManual() {
    return this.loyaltyService.auditManualTransactions();
  }
}