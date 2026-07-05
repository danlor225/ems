// ============================================================
//  CertificatesPublicController : vérification PUBLIQUE d'un
//  certificat par son code. AUCUNE authentification (c'est le
//  but : n'importe qui peut vérifier l'authenticité via le QR).
//  Rate-limité pour éviter l'énumération de codes.
// ============================================================
import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CertificatesService } from './certificates.service';

@Controller('certificates')
export class CertificatesPublicController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('verify/:code')
  verify(@Param('code') code: string) {
    return this.certificatesService.verify(code);
  }
}
