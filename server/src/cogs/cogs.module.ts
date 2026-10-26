import { Module } from '@nestjs/common';
import { CogsController } from './cogs.controller';
import { CogsService } from './cogs.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CogsController],
  providers: [CogsService],
  exports: [CogsService],
})
export class CogsModule {}
