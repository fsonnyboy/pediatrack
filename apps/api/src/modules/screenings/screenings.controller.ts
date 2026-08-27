import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ScreeningsService } from './screenings.service';
import { CreateScreeningDto } from './dto/create-screening.dto';
import { QueryScreeningsDto, DueSoonQueryDto } from './dto/query-screenings.dto';
import { CreateReferralDto } from './dto/create-referral.dto';
import { UpdateReferralDto } from './dto/update-referral.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

// Screening results are sensitive even by PHI standards — GET routes are
// deliberately restricted to clinical staff and do not inherit the
// patient-record default (vaccinations' GETs, by contrast, are open to any
// authenticated role including RECEPTIONIST).
const CLINICAL_ROLES = ['ADMIN', 'DOCTOR', 'NURSE'] as const;

@ApiTags('Screenings')
@ApiBearerAuth('JWT')
@Controller()
export class ScreeningsController {
  constructor(private readonly screeningsService: ScreeningsService) {}

  @Get('screening-instruments')
  @ApiOperation({ summary: 'Developmental screening instrument catalogue' })
  listInstruments() {
    return this.screeningsService.listInstruments();
  }

  @Post('screenings')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'Record a completed developmental screening' })
  create(@Body() dto: CreateScreeningDto, @CurrentUser('id') userId: string) {
    return this.screeningsService.create(dto, userId);
  }

  @Get('screenings')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'List screening administrations' })
  findAll(@Query() query: QueryScreeningsDto) {
    return this.screeningsService.findAll(query);
  }

  @Get('screenings/due-soon')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'Screenings due within the window, overdue ones first' })
  dueSoon(@Query() query: DueSoonQueryDto) {
    return this.screeningsService.dueSoon(query.days);
  }

  @Get('screenings/referrals/open')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'Referrals still in flight (PENDING or SCHEDULED)' })
  openReferrals() {
    return this.screeningsService.openReferrals();
  }

  @Get('screenings/referrals/unaddressed')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'REFER-outcome screenings with no referral on file' })
  unaddressedReferrals() {
    return this.screeningsService.unaddressedReferrals();
  }

  @Get('screenings/:id')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'Get one screening administration' })
  findOne(@Param('id') id: string) {
    return this.screeningsService.findOne(id);
  }

  @Post('screenings/:id/referral')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'Open a referral for a screening result' })
  createReferral(
    @Param('id') id: string,
    @Body() dto: CreateReferralDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.screeningsService.createReferral(id, dto, userId);
  }

  @Patch('screening-referrals/:id')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'Update a referral status (scheduled, completed, declined, lost)' })
  updateReferral(
    @Param('id') id: string,
    @Body() dto: UpdateReferralDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.screeningsService.updateReferral(id, dto, userId);
  }
}
