import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as express from 'express';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('CryptoSentinelAPI');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    cors: {
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    },
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix('');

  await app.listen(port);

  logger.log('='.repeat(60));
  logger.log('🚀 Crypto Sentinel API Server Started');
  logger.log(`   REST API:     http://localhost:${port}/api`);
  logger.log(`   WebSocket:    ws://localhost:${port}/crypto-stream`);
  logger.log(`   Environment:  ${process.env.NODE_ENV || 'development'}`);
  logger.log(`   Port:         ${port}`);
  logger.log('='.repeat(60));
  logger.log('API Endpoints:');
  logger.log(`   GET /api/stats                 -> 系统统计信息`);
  logger.log(`   GET /api/risk-addresses        -> 风险地址列表`);
  logger.log(`   GET /api/risk-addresses/high   -> 高风险地址`);
  logger.log(`   GET /api/address/:addr/risk    -> 单地址风险详情`);
  logger.log(`   GET /api/throughput            -> 吞吐量历史`);
  logger.log(`   GET /api/transactions/large    -> 大额交易`);
  logger.log('='.repeat(60));
}

bootstrap();
