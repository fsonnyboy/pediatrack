import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateAppointmentDto, AppointmentStatusEnum } from './create-appointment.dto';

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  diagnosis?: string;
}

export class UpdateStatusDto {
  @ApiPropertyOptional({ enum: AppointmentStatusEnum })
  @IsEnum(AppointmentStatusEnum)
  status!: AppointmentStatusEnum;

  @ApiPropertyOptional({ description: 'Required when cancelling' })
  @IsOptional() @IsString() @MaxLength(500)
  cancellationReason?: string;
}
