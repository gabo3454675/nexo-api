import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'nexo-dev-secret',
    }),
  ],
  controllers: [EscrowController],
  providers: [EscrowService],
})
export class EscrowModule {}
