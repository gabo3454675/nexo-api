import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, RolesGuard],
})
export class PaymentsModule {}
