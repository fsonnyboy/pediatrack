import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto, UpdateStatusDto } from './dto/update-appointment.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';
import { CreateVitalSignsDto } from './dto/vital-signs.dto';
import { CreateMedicalNoteDto } from './dto/medical-note.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '@peditrack/types';

@ApiTags('Appointments')
@ApiBearerAuth('JWT')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // SEC-008 fix: only clinical staff and admin may create appointments.
  // PARENT accounts (future mobile) should use a dedicated patient-facing endpoint.
  @Post()
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Book a new appointment' })
  @ApiResponse({ status: 409, description: 'The slot overlaps an existing appointment' })
  create(@Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @ApiOperation({ summary: 'List appointments with date range and status filters' })
  findAll(@Query() query: QueryAppointmentsDto) {
    return this.appointmentsService.findAll(query);
  }

  @Get(':id')
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Full visit detail — vitals, notes, prescriptions, vaccines' })
  findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne(id);
  }

  // Only clinical staff may reschedule — receptionists can via the status path.
  @Patch(':id')
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Reschedule or update an appointment' })
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointmentsService.update(id, dto);
  }

  // SEC-008 fix: gate the status-change endpoint and pass the requester's role
  // to the service so it can enforce status-specific transition rules.
  // e.g. only DOCTOR/ADMIN may mark COMPLETED; RECEPTIONIST may only confirm or cancel.
  @Patch(':id/status')
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Confirm, start, complete or cancel an appointment' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.appointmentsService.updateStatus(id, dto, user.role);
  }

  @Post(':id/vitals')
  @Roles('ADMIN', 'DOCTOR', 'NURSE')
  @ApiOperation({ summary: 'Record vital signs for this visit' })
  recordVitals(
    @Param('id') id: string,
    @Body() dto: CreateVitalSignsDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.appointmentsService.recordVitals(id, dto, userId);
  }

  @Post(':id/notes')
  @Roles('ADMIN', 'DOCTOR', 'NURSE')
  @ApiOperation({ summary: 'Add a clinical note to this visit' })
  addNote(
    @Param('id') id: string,
    @Body() dto: CreateMedicalNoteDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.appointmentsService.addNote(id, dto, userId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete an appointment permanently' })
  remove(@Param('id') id: string) {
    return this.appointmentsService.remove(id);
  }
}
