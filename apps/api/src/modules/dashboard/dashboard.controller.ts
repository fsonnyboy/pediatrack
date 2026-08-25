import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Headline clinic statistics' })
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('overview')
  @ApiOperation({ summary: 'Stats, upcoming appointments and recent patients in one call' })
  getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Upcoming appointments' })
  @ApiQuery({ name: 'days', required: false, example: 7 })
  getUpcoming(@Query('days') days?: string) {
    return this.dashboardService.getUpcoming(days ? Number(days) : 7);
  }

  @Get('today')
  @ApiOperation({ summary: "Today's schedule grouped by status" })
  getToday() {
    return this.dashboardService.getTodaySchedule();
  }

  @Get('recent-patients')
  @ApiOperation({ summary: 'Recently registered patients' })
  @ApiQuery({ name: 'limit', required: false, example: 8 })
  getRecentPatients(@Query('limit') limit?: string) {
    return this.dashboardService.getRecentPatients(limit ? Number(limit) : 8);
  }
}
