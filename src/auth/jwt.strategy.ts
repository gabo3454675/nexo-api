import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  accountStatus: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'nexo-dev-secret',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        accountStatus: true,
        isKycVerified: true,
        trustScore: true,
        nexoPoints: true,
        balance: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Token inválido');
    }

    return user;
  }
}
