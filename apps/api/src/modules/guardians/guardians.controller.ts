import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { GuardiansService } from './guardians.service';
import { CreateGuardianDto, UpdateGuardianDto } from './dto/guardian.dto';

@ApiTags('Guardians')
@ApiBearerAuth('JWT')
@Controller('guardians')
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Post()
  @ApiOperation({ summary: 'Add a guardian to a patient' })
  create(@Body() dto: CreateGuardianDto) {
    return this.guardiansService.create(dto);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'All guardians for a patient' })
  findByPatient(@Param('patientId') patientId: string) {
    return this.guardiansService.findByPatient(patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one guardian' })
  findOne(@Param('id') id: string) {
    return this.guardiansService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update guardian details' })
  update(@Param('id') id: string, @Body() dto: UpdateGuardianDto) {
    return this.guardiansService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a guardian' })
  remove(@Param('id') id: string) {
    return this.guardiansService.remove(id);
  }
}
