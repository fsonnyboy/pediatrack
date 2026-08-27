import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { MilestonesService } from './milestones.service';
import { CreateMilestoneObservationsDto } from './dto/create-observations.dto';
import { QueryMilestoneDefinitionsDto } from './dto/query-milestones.dto';
import { CreateConcernDto } from './dto/create-concern.dto';
import { UpdateConcernDto } from './dto/update-concern.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

// Same policy as screenings — developmental data is restricted to clinical
// staff and does not inherit the patient-record default.
const CLINICAL_ROLES = ['ADMIN', 'DOCTOR', 'NURSE'] as const;

@ApiTags('Milestones')
@ApiBearerAuth('JWT')
@Controller()
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Get('milestone-definitions')
  @ApiOperation({ summary: 'Developmental milestone checklist catalogue, optionally filtered by age' })
  listDefinitions(@Query() query: QueryMilestoneDefinitionsDto) {
    return this.milestonesService.listDefinitions(query);
  }

  @Post('milestones/observations')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'Record a checklist pass — one or more milestone observations for a visit' })
  createObservations(@Body() dto: CreateMilestoneObservationsDto, @CurrentUser('id') userId: string) {
    return this.milestonesService.createObservations(dto, userId);
  }

  @Post('milestones/concerns')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'Record a developmental concern raised by a caregiver, clinician, or other' })
  createConcern(@Body() dto: CreateConcernDto, @CurrentUser('id') userId: string) {
    return this.milestonesService.createConcern(dto, userId);
  }

  @Get('milestones/concerns/open')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'Developmental concerns not yet resolved' })
  openConcerns() {
    return this.milestonesService.openConcerns();
  }

  @Patch('milestones/concerns/:id')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'Update the action taken on a concern, or resolve/reopen it' })
  updateConcern(
    @Param('id') id: string,
    @Body() dto: UpdateConcernDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.milestonesService.updateConcern(id, dto, userId);
  }
}
