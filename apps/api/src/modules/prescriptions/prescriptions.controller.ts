import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto, UpdatePrescriptionStatusDto } from './dto/create-prescription.dto';
import { QueryPrescriptionsDto } from './dto/query-prescriptions.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Prescriptions')
@ApiBearerAuth('JWT')
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Issue a new prescription' })
  @ApiResponse({ status: 400, description: 'A prescribed medicine conflicts with a recorded allergy' })
  create(@Body() dto: CreatePrescriptionDto, @CurrentUser('id') doctorId: string) {
    return this.prescriptionsService.create(dto, doctorId);
  }

  @Get()
  @ApiOperation({ summary: 'List prescriptions' })
  findAll(@Query() query: QueryPrescriptionsDto) {
    return this.prescriptionsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Prescription with all its medicines' })
  findOne(@Param('id') id: string) {
    return this.prescriptionsService.findOne(id);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Mark a prescription completed or cancelled' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePrescriptionStatusDto) {
    return this.prescriptionsService.updateStatus(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a prescription' })
  remove(@Param('id') id: string) {
    return this.prescriptionsService.remove(id);
  }
}
