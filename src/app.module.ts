import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EscrowModule } from './escrow/escrow.module';
import { KycModule } from './kyc/kyc.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    AuthModule,
    EscrowModule,
    PaymentsModule,
    KycModule,
    WalletModule,
    MarketplaceModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
