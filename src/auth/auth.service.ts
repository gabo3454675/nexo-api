import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login({ email, password }: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        accountStatus: true,
        isKycVerified: true,
        trustScore: true,
        balance: true,
        nexoPoints: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.accountStatus === 'BANNED') {
      throw new ForbiddenException('Cuenta baneada. Contacta a soporte');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          isKycVerified: user.isKycVerified,
          role: user.role,
          accountStatus: user.accountStatus,
          trustScore: user.trustScore,
          balance: user.balance,
          nexoPoints: user.nexoPoints,
        },
      },
      message: 'Login exitoso',
    };
  }

  async register({ email, password, name }: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'USER',
        accountStatus: 'PENDING_VERIFICATION',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accountStatus: true,
        isKycVerified: true,
        trustScore: true,
        balance: true,
        nexoPoints: true,
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isKycVerified: user.isKycVerified,
          role: user.role,
          accountStatus: user.accountStatus,
          trustScore: user.trustScore,
          balance: user.balance,
          nexoPoints: user.nexoPoints,
        },
      },
      message: 'Registro exitoso',
    };
  }

  async activateSellerMode(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isKycVerified: true,
        accountStatus: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!user.isKycVerified || user.accountStatus !== 'VERIFIED') {
      throw new ForbiddenException(
        'Debes completar verificacion KYC y tener cuenta verificada para vender',
      );
    }

    if (user.role === 'TECHNICIAN') {
      return {
        success: true,
        data: { role: user.role },
        message: 'Modo vendedor ya activo',
      };
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { role: 'TECHNICIAN' },
      select: { role: true },
    });

    return {
      success: true,
      data: { role: updated.role },
      message: 'Modo vendedor activado',
    };
  }
}
