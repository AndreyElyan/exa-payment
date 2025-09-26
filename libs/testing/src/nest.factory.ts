import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

export class NestTestFactory {
  static async createTestingModule(moduleMetadata: any): Promise<TestingModule> {
    return Test.createTestingModule(moduleMetadata).compile();
  }

  static async createApp(module: TestingModule): Promise<INestApplication> {
    const app = module.createNestApplication();
    await app.init();
    return app;
  }

  static async closeApp(app: INestApplication): Promise<void> {
    await app.close();
  }
}
