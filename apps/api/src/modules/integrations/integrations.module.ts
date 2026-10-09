import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module.js';
import { CredentialCrypto } from './credential-crypto.js';
import { WordpressClient } from './wordpress/wordpress-client.js';
import { HttpWordpressClient } from './wordpress/wordpress-http.client.js';
import { WordpressExportController } from './wordpress-export.controller.js';
import { WordpressIntegrationController } from './wordpress.controller.js';
import { WordpressService } from './wordpress.service.js';

@Module({
  imports: [ContentModule],
  controllers: [WordpressIntegrationController, WordpressExportController],
  providers: [
    CredentialCrypto,
    WordpressService,
    { provide: WordpressClient, useClass: HttpWordpressClient },
  ],
  exports: [WordpressService, CredentialCrypto, WordpressClient],
})
export class IntegrationsModule {}
