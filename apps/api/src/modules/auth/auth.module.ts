import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokenService } from './token.service';
import { EmailVerificationService } from './email-verification.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenService, EmailVerificationService],
})
export class AuthModule {}
