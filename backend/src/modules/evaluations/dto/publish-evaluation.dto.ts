import { IsISO8601 } from 'class-validator';

export class PublishEvaluationDto {
  @IsISO8601({}, { message: "Date d'ouverture invalide." })
  opensAt: string;

  @IsISO8601({}, { message: 'Date de fermeture invalide.' })
  closesAt: string;
}
