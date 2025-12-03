import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { raw } from 'body-parser';

// Load environment variables from .env file
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable raw body for Stripe webhook
  app.use('/billing/webhook', raw({ type: 'application/json' }));
  
  app.enableCors();
  await app.listen(3001);
  console.log('Backend server is running on http://localhost:3001');
}
bootstrap();

