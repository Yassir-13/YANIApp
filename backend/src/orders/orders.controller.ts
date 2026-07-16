import {
  Controller, Post, Get, Patch, Body, Param, Query, Req, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ----- CLIENT : ses propres commandes -----

  @Post()
  create(@Req() req: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user.id, dto);
  }

  @Get('me')
  findMine(@Req() req: any) {
    return this.ordersService.findMine(req.user.id);
  }

  @Get('me/:id')
  findOneForUser(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOneForUser(id, req.user.id);
  }

  @Patch('me/:id/cancel')
  cancelMine(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.cancelByClient(id, req.user.id);
  }

  // ----- STAFF / ADMIN : gestion des commandes -----

  @UseGuards(RolesGuard)
  @Roles('STAFF', 'ADMIN')
  @Get()
  findAll(@Query('status') status?: OrderStatus) {
    return this.ordersService.findAll(status);
  }

  @UseGuards(RolesGuard)
  @Roles('STAFF', 'ADMIN')
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto.status);
  }
}