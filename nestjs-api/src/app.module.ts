import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClickHouseService } from './clickhouse/clickhouse.service';
import { CryptoController } from './controllers/crypto.controller';
import { CryptoStreamGateway } from './gateway/crypto-stream.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [CryptoController],
  providers: [ClickHouseService, CryptoStreamGateway],
})
export class AppModule {}
