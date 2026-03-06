import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Redirect,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';

interface RequestWithUser extends Request {
  user: { id: string; email: string; accessToken?: string; refreshToken?: string };
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @UseGuards(LocalAuthGuard)
  @HttpCode(200)
  @Post('login')
  login(@Request() req: RequestWithUser) {
    return this.authService.login(req.user);
  }

  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleAuth() {
    // Passport redirects to Google — no body needed
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  @Redirect()
  googleCallback(@Request() req: RequestWithUser) {
    const { accessToken, refreshToken } = req.user as any;
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    return {
      url: `${frontendUrl}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`,
    };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('logout')
  logout() {
    return { message: 'Logged out successfully' };
  }
}
