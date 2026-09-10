import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { RequestWithUser } from '../../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Credential endpoints get a tighter window than the global 20/min so a
  // single IP can't brute-force passwords or probe verification tokens.
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return { success: true, data: await this.auth.register(dto) };
  }

  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return { success: true, data: await this.auth.login(dto) };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return { success: true, data: await this.auth.verifyEmail(dto.token) };
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.auth.resendVerificationEmail(dto.email);
    // Always a generic success — see AuthService.resendVerificationEmail for why.
    return { success: true, data: { sent: true } };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return { success: true, data: await this.auth.refresh(dto.refreshToken) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: RequestWithUser, @Body() dto: RefreshDto) {
    await this.auth.logout(req.user.sub, dto.refreshToken);
    return { success: true, data: { loggedOut: true } };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: RequestWithUser) {
    return { success: true, data: await this.auth.me(req.user.sub) };
  }
}
