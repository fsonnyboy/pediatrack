import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { QueryPatientsDto } from './dto/query-patients.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@peditrack/types';

// ── Role policy for this resource ─────────────────────────────────────────
//
// RECEPTIONIST  — can view patient list and profile (read-only front desk use)
// NURSE         — can view + create + update patients and most clinical data
// DOCTOR        — same as NURSE + can archive and view clinical notes
// ADMIN         — full access
//
// PARENT (future mobile portal) — may only read their own children's records;
//   enforced by passing the requesting user through to the service layer
//   (see SEC-006 note in patients.service.ts).

@ApiTags('Patients')
@ApiBearerAuth('JWT')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  // SEC-005 fix: RECEPTIONISTs must not create patient records — clinical responsibility.
  @Post()
  @Roles('ADMIN', 'DOCTOR', 'NURSE')
  @ApiOperation({ summary: 'Register a new patient' })
  @ApiResponse({ status: 201, description: 'Patient created with an auto-generated MRN' })
  create(@Body() dto: CreatePatientDto, @CurrentUser() user: AuthUser) {
    // SEC-016 fix: pass requesting user ID for PHI audit logging.
    return this.patientsService.create(dto, user.id);
  }

  @Get()
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @ApiOperation({ summary: 'List patients with search, filters and pagination' })
  findAll(@Query() query: QueryPatientsDto, @CurrentUser() user: AuthUser) {
    return this.patientsService.findAll(query, user.id);
  }

  @Get(':id')
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Get a patient profile' })
  @ApiParam({ name: 'id', description: 'Patient cuid' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    // TODO (PARENT role): service will enforce child ownership once PARENT role is active.
    return this.patientsService.findOne(id, user.id);
  }

  // SEC-005 fix: only clinical staff may update a patient record.
  @Patch(':id')
  @Roles('ADMIN', 'DOCTOR', 'NURSE')
  @ApiOperation({ summary: 'Update patient details' })
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto, @CurrentUser() user: AuthUser) {
    return this.patientsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Archive a patient (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.patientsService.remove(id, user.id);
  }

  @Get(':id/appointments')
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Visit history for a patient' })
  getAppointments(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.patientsService.getAppointments(id, user.id);
  }

  @Get(':id/vaccinations')
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Immunization history for a patient' })
  getVaccinations(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.patientsService.getVaccinations(id, user.id);
  }

  // SEC-005 fix: prescriptions contain sensitive PHI — restrict to clinical staff.
  @Get(':id/prescriptions')
  @Roles('ADMIN', 'DOCTOR', 'NURSE')
  @ApiOperation({ summary: 'All prescriptions issued to a patient' })
  getPrescriptions(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.patientsService.getPrescriptions(id, user.id);
  }

  @Get(':id/growth-chart')
  @Roles('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Weight, height and head-circumference history over time' })
  getGrowthChart(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.patientsService.getGrowthChart(id, user.id);
  }

  @Get(':id/notes')
  @Roles('ADMIN', 'DOCTOR', 'NURSE')
  @ApiOperation({ summary: 'Clinical notes for a patient' })
  getNotes(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.patientsService.getMedicalNotes(id, user.id);
  }
}
