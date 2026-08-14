import {
  Controller, Get, Post, Patch, Body, Param, Delete, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceCategoryDto } from './dto/create-category.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // ----- Routes PUBLIQUES -----

  @Get()
  findAll() {
    return this.servicesService.findAllActive();
  }

  @Get('categories')
  findCategories() {
    return this.servicesService.findAllCategories();
  }

  // ⚠️ Doit rester AVANT @Get(':id'), sinon « all » serait interprété
  // comme un identifiant et rejeté par ParseUUIDPipe.
  @ApiOperation({ summary: 'Toutes les prestations, y compris désactivées (staff/admin)' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'ADMIN')
  @Get('all')
  findAllIncludingInactive() {
    return this.servicesService.findAllIncludingInactive();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findOne(id);
  }

  // ----- Routes ADMIN -----

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('categories')
  createCategory(@Body() dto: CreateServiceCategoryDto) {
    return this.servicesService.createCategory(dto);
  }

  // Renommer, c'est envoyer le même corps que créer : une catégorie n'a qu'un
  // nom. Pas d'Update DTO pour redire la même chose.
  @ApiOperation({ summary: 'Renommer une catégorie' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('categories/:id')
  renameCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateServiceCategoryDto,
  ) {
    return this.servicesService.renameCategory(id, dto.name);
  }

  @ApiOperation({ summary: 'Supprimer une catégorie vide' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('categories/:id')
  deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.deleteCategory(id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  createService(@Body() dto: CreateServiceDto) {
    return this.servicesService.createService(dto);
  }

  @ApiOperation({ summary: 'Modifier une prestation (prix, durée, description, réactivation…)' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Désactiver une prestation (suppression douce)' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.deactivate(id);
  }
}