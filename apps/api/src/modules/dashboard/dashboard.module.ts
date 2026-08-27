import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { VaccinationsModule } from '../vaccinations/vaccinations.module';
import { ScreeningsModule } from '../screenings/screenings.module';

@Module({
  imports: [VaccinationsModule, ScreeningsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
