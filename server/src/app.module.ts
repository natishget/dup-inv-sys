import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { PurchasesModule } from './purchases/purchases.module';
import { SalesModule } from './sales/sales.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import authConfig from './config/auth.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [authConfig],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('auth.throttle.ttl') || 60000,
          limit: configService.get<number>('auth.throttle.limit') || 100,
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    WarehousesModule,
    PurchasesModule,
    SalesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
