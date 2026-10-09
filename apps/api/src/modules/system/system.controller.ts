import { Controller, Get } from '@nestjs/common';
import { AnalysisService } from '../analysis/index.js';
import { ImageService } from '../content/image.service.js';
import { CredentialCrypto } from '../integrations/credential-crypto.js';

@Controller('system')
export class SystemController {
  constructor(
    private readonly analysis: AnalysisService,
    private readonly images: ImageService,
    private readonly crypto: CredentialCrypto,
  ) {}

  @Get('status')
  status() {
    return {
      analysis: this.analysis.status(),
      image: this.images.status(),
      integrations: { encryptionConfigured: this.crypto.isConfigured() },
    };
  }
}
