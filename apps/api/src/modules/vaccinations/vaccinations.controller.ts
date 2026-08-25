import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { VaccinationsService } from './vaccinations.service';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';
import { QueryVaccinationsDto, DueSoonQueryDto } from './dto/query-vaccinations.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Vaccinations')
@ApiBearerAuth('JWT')
@Controller()
export class VaccinationsController {
  constructor(private readonly vaccinationsService: VaccinationsService) {}

  @Get('vaccines')
  @ApiOperation({ summary: 'Vaccine reference catalogue' })
  listVaccines() {
    return this.vaccinationsService.listVaccines();
  }

  @Post('vaccinations')
  @Roles('ADMIN', 'DOCTOR', 'NURSE')
  @ApiOperation({ summary: 'Record an administered vaccine dose' })
  create(@Body() dto: CreateVaccinationDto, @CurrentUser('id') userId: string) {
    return this.vaccinationsService.create(dto, userId);
  }

  @Get('vaccinations')
  @ApiOperation({ summary: 'List vaccination records' })
  findAll(@Query() query: QueryVaccinationsDto) {
    return this.vaccinationsService.findAll(query);
  }

  @Get('vaccinations/due-soon')
  @ApiOperation({ summary: 'Doses due within the window, overdue ones first' })
  dueSoon(@Query() query: DueSoonQueryDto) {
    return this.vaccinationsService.dueSoon(query.days);
  }

  @Get('vaccinations/schedule/:patientId')
  @ApiOperation({ summary: "A patient's full immunization card" })
  schedule(@Param('patientId') patientId: string) {
    return this.vaccinationsService.patientSchedule(patientId);
  }

  @Get('vaccinations/:id')
  @ApiOperation({ summary: 'Get one vaccination record' })
  findOne(@Param('id') id: string) {
    return this.vaccinationsService.findOne(id);
  }

  @Patch('vaccinations/:id')
  @Roles('ADMIN', 'DOCTOR', 'NURSE')
  @ApiOperation({ summary: 'Correct a vaccination record' })
  update(@Param('id') id: string, @Body() dto: UpdateVaccinationDto) {
    return this.vaccinationsService.update(id, dto);
  }

  @Delete('vaccinations/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a vaccination record' })
  remove(@Param('id') id: string) {
    return this.vaccinationsService.remove(id);
  }
}
