import { IsUUID } from 'class-validator';

export class IssueCertificateDto {
  @IsUUID()
  attemptId!: string;
}
