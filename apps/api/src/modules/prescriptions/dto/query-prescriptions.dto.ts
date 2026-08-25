import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { PrescriptionStatusEnum } from './create-prescription.dto';

export class QueryPrescriptionsDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  patientId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  doctorId?: string;

  @ApiPropertyOptional({ enum: PrescriptionStatusEnum })
  @IsOptional() @IsEnum(PrescriptionStatusEnum)
  status?: PrescriptionStatusEnum;
}
