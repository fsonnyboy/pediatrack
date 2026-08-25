import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { VaccinationsModule } from '../vaccinations/vaccinations.module';

@Module({
  imports: [VaccinationsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
