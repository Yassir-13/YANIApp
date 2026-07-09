import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ----- CLIENT : son propre compte -----

  @Get('me')
  getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Patch('me')
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Patch('me/password')
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(req.user.id, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  deleteAccount(@Req() req: any) {
    return this.usersService.deleteAccount(req.user.id);
  }

  // ----- STAFF / ADMIN : recherche de clients -----

  @UseGuards(RolesGuard)
  @Roles('STAFF', 'ADMIN')
  @Get()
  findAll(@Query('search') search?: string) {
    return this.usersService.findAll(search);
  }

  // ----- ADMIN seul : gestion des rôles -----

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/role')
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.usersService.updateRole(id, dto.role);
  }
}