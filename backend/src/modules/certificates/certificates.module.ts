import { Module } from '@nestjs/common';
import { CertificatesPublicController } from './certificates-public.controller';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';

@Module({
  controllers: [CertificatesController, CertificatesPublicController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
