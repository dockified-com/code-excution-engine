import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Dockified Code Execution API')
    .setDescription(
      'Shared judge gateway for AI Tutor, Dockified Lab, and LMS. ' +
        'Product backends call with Bearer API keys; students never hold keys or call Piston.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description:
          'Product backend API key from env API_KEYS (e.g. dev-key-tutor)',
      },
      'api-key',
    )
    .addTag('health', 'Ops liveness (no auth)')
    .addTag('execution', 'Run and judge student code')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`Swagger UI: http://localhost:${port}/docs`);
}
void bootstrap();
