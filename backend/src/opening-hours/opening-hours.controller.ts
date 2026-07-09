import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
} from '@nestjs/common';
import { OpeningHoursService } from './opening-hours.service';
import { UpdateHoursDto } from './dto/update-hours.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('opening-hours')
@Controller('opening-hours')
export class OpeningHoursController {
  constructor(private readonly openingHoursService: OpeningHoursService) {}

  // Public : consultation des horaires
  @Get()
  findAll() {
    return this.openingHoursService.findAll();
  }

  // Admin : configuration d'un jour
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put()
  setForDay(@Body() dto: UpdateHoursDto) {
    return this.openingHoursService.setForDay(dto);
  }
}