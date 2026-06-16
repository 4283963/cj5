import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClickHouseService } from './clickhouse/clickhouse.service';
import { CryptoController } from './controllers/crypto.controller';
import { CryptoStreamGateway } from './gateway/crypto-stream.gateway';
import { AIDiagnosisService } from './services/ai-diagnosis.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [CryptoController],
  providers: [ClickHouseService, CryptoStreamGateway, AIDiagnosisService],
})
export class AppModule {}
