import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // ----- Routes PUBLIQUES (lecture, sans authentification) -----

  @Get()
  findAll() {
    return this.servicesService.findAllActive();
  }

  @Get('categories')
  findCategories() {
    return this.servicesService.findAllCategories();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findOne(id);
  }

  // ----- Routes ADMIN (écriture, protégées) -----

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.servicesService.createCategory(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  createService(@Body() dto: CreateServiceDto) {
    return this.servicesService.createService(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.deactivate(id);
  }
}