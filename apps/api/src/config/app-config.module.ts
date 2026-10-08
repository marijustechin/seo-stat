import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

/**
 * Configuration infrastructure. Loads environment variables (and an optional
 * .env file) into the application; kept separate from domain modules.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true })],
})
export class AppConfigModule {}
