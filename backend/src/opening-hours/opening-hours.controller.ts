import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OpeningHoursService } from './opening-hours.service';
import { UpdateHoursDto } from './dto/update-hours.dto';
import { CreateClosureDto } from './dto/create-closure.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('opening-hours')
@Controller('opening-hours')
export class OpeningHoursController {
  constructor(private readonly openingHoursService: OpeningHoursService) {}

  // Public : consultation des horaires
  @Get()
  findAll() {
    return this.openingHoursService.findAll();
  }

  // ⚠️ Doit rester avant toute route à paramètre : « closures » serait sinon
  // pris pour un identifiant.
  @ApiOperation({ summary: 'Fermetures exceptionnelles (congés, jours fériés)' })
  @Get('closures')
  findClosures() {
    return this.openingHoursService.findClosures();
  }

  // Admin : redéfinit les plages d'un jour (liste vide = fermé)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put()
  setForDay(@Body() dto: UpdateHoursDto) {
    return this.openingHoursService.setForDay(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('closures')
  createClosure(@Body() dto: CreateClosureDto) {
    return this.openingHoursService.createClosure(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('closures/:id')
  deleteClosure(@Param('id', ParseUUIDPipe) id: string) {
    return this.openingHoursService.deleteClosure(id);
  }
}
