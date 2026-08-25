import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePatientDto } from './create-patient.dto';

/** Guardians are managed through their own endpoints, not via patient update. */
export class UpdatePatientDto extends PartialType(
  OmitType(CreatePatientDto, ['guardians'] as const),
) {}
