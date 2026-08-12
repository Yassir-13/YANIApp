import {
  Controller,
  Post,
  Get,
  Query,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateForClientDto } from './dto/create-for-client.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { RescheduleDto } from './dto/reschedule.dto';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { FindAppointmentsQueryDto } from './dto/find-appointments-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('appointments')
@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // Route (publique)
  @Public()
  @Get('availability')
  getAvailability(@Query() query: AvailabilityQueryDto) {
    return this.appointmentsService.getAvailability(query.serviceId, query.date);
  }

  // ----- CLIENT (et tous) -----

  @Post()
  create(@Req() req: any, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(req.user.id, dto);
  }

  @Get()
  findMine(@Req() req: any, @Query() query: FindAppointmentsQueryDto) {
    return this.appointmentsService.findForUser(
      req.user.id,
      req.user.role,
      query,
    );
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.appointmentsService.cancel(id, req.user.id, req.user.role);
  }

  // ----- STAFF / ADMIN -----

  @UseGuards(RolesGuard)
  @Roles('STAFF', 'ADMIN')
  @Post('for-client')
  createForClient(@Body() dto: CreateForClientDto) {
    return this.appointmentsService.createForClient(dto.userId, {
      serviceId: dto.serviceId,
      startAt: dto.startAt,
    });
  }

  @UseGuards(RolesGuard)
  @Roles('STAFF', 'ADMIN')
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.appointmentsService.updateStatus(id, dto.status);
  }

  @UseGuards(RolesGuard)
  @Roles('STAFF', 'ADMIN')
  @Patch(':id/reschedule')
  reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleDto,
  ) {
    return this.appointmentsService.reschedule(id, dto.startAt);
  }
}