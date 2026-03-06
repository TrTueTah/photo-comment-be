import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly refreshSecret =
    process.env.REFRESH_TOKEN_SECRET ?? 'refresh-secret';
  private readonly refreshExpiresIn =
    process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d';

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private signTokens(user: AuthUser): TokenPair {
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn as never,
    });
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto): Promise<TokenPair> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash },
    });
    return this.login(user);
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
    return { id: user.id, email: user.email };
  }

  login(user: AuthUser): TokenPair {
    return this.signTokens(user);
  }

  refreshTokens(refreshToken: string): TokenPair {
    try {
      const payload = this.jwtService.verify<{ sub: string; email: string }>(
        refreshToken,
        { secret: this.refreshSecret },
      );
      return this.signTokens({ id: payload.sub, email: payload.email });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async googleLogin(profile: GoogleProfile): Promise<TokenPair> {
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (!user) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });
      if (byEmail) {
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId: profile.googleId },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            googleId: profile.googleId,
          },
        });
      }
    }

    return this.login(user);
  }
}
