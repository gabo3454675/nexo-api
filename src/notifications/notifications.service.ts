import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private initialized = false;

  constructor(private readonly prisma: PrismaService) {
    this.initFirebase();
  }

  private initFirebase() {
    if (this.initialized || admin.apps.length > 0) {
      this.initialized = true;
      return;
    }

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_JSON no configurado. Push notifications desactivadas.',
      );
      return;
    }

    try {
      const serviceAccount = JSON.parse(raw);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      this.initialized = true;
    } catch (error) {
      this.logger.error('No se pudo inicializar Firebase Admin SDK', error);
    }
  }

  async notifyDealStatusChange(
    userId: string,
    status: string,
    dealId: string,
    body: string,
  ) {
    if (!this.initialized) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });
    if (!user?.pushToken) {
      return;
    }

    try {
      await admin.messaging().send({
        token: user.pushToken,
        notification: {
          title: `Actualizacion de trato: ${status}`,
          body,
        },
        data: {
          dealId,
          status,
        },
      });
    } catch (error) {
      this.logger.warn(`No se pudo enviar push a ${userId}: ${String(error)}`);
    }
  }
}
