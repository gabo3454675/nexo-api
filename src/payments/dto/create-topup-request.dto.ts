import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export class CreateTopUpRequestDto {
  @ApiProperty({ enum: PaymentProvider, example: PaymentProvider.PAGO_MOVIL })
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;

  @ApiProperty({ example: '25.50' })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount debe ser un decimal positivo con hasta 2 decimales',
  })
  amount!: string;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @Matches(/^[A-Z]{3,6}$/)
  currency!: string;

  @ApiProperty({
    example: 'https://cdn.nexo.local/receipts/comprobante-123.jpg',
  })
  @IsString()
  receiptUrl!: string;

  @ApiPropertyOptional({ example: 'ZELLE-TRANSFER-88821' })
  @IsOptional()
  @IsString()
  paymentRef?: string;

  @ApiPropertyOptional({ example: 'Pago realizado desde Bank of America' })
  @IsOptional()
  @IsString()
  notes?: string;
}
