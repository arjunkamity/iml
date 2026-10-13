import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.enableCors({ origin: true, credentials: true });

  // ---- OpenAPI / Swagger ----
  const swaggerConfig = new DocumentBuilder()
    .setTitle('India Mind League API')
    .setDescription(
      'REST API for the India Mind League digital qualifier platform. ' +
        'Roles: ADMIN, COORDINATOR, STUDENT. Most endpoints require a Bearer JWT ' +
        'obtained from /api/auth/login (Admin/Coordinator) or /api/auth/otp/verify (Student).',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addServer('http://localhost:3000/api', 'Local dev')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Apply the bearer scheme globally so "Authorize" in the UI covers every endpoint.
  document.security = [{ bearer: [] }];

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Export the spec so it can be imported into Postman / Insomnia.
  writeFileSync(join(process.cwd(), 'openapi.json'), JSON.stringify(document, null, 2));

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  console.log(`IML API running on http://localhost:${port}/api`);
  console.log(`Swagger UI:        http://localhost:${port}/docs`);
}
void bootstrap();
