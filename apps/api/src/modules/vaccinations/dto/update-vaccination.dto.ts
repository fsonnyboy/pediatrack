import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateVaccinationDto } from './create-vaccination.dto';

/** Patient, vaccine and dose number identify the record and cannot be changed. */
export class UpdateVaccinationDto extends PartialType(
  OmitType(CreateVaccinationDto, ['patientId', 'vaccineId', 'doseNumber'] as const),
) {}
