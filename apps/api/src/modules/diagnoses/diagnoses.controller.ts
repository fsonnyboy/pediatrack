import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { DiagnosesService } from './diagnoses.service';
import { QueryDiagnosisCodesDto } from './dto/query-diagnosis-codes.dto';
import { CreateDiagnosisDto } from './dto/create-diagnosis.dto';
import { UpdateDiagnosisDto } from './dto/update-diagnosis.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

// Same policy as milestones — coded clinical diagnosis is restricted to
// clinical staff and does not inherit the patient-record default.
const CLINICAL_ROLES = ['ADMIN', 'DOCTOR', 'NURSE'] as const;

@ApiTags('Diagnoses')
@ApiBearerAuth('JWT')
@Controller()
export class DiagnosesController {
  constructor(private readonly diagnosesService: DiagnosesService) {}

  @Get('diagnosis-codes')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: "Search the diagnosis code catalogue, ranked by this clinic's usage" })
  searchCodes(@Query() query: QueryDiagnosisCodesDto) {
    return this.diagnosesService.searchCodes(query);
  }

  @Post('diagnoses')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: "Add a coded diagnosis to a patient's problem list" })
  create(@Body() dto: CreateDiagnosisDto, @CurrentUser('id') userId: string) {
    return this.diagnosesService.createDiagnosis(dto, userId);
  }

  @Patch('diagnoses/:id')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'Update status, certainty or note on a patient diagnosis' })
  update(@Param('id') id: string, @Body() dto: UpdateDiagnosisDto, @CurrentUser('id') userId: string) {
    return this.diagnosesService.updateDiagnosis(id, dto, userId);
  }
}
