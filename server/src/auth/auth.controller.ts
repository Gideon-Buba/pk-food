import { Controller, Post, Get, Body, Query, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
  ): Promise<{ data: null; message: string }> {
    await this.authService.register(dto.email, dto.password);
    return { data: null, message: 'Account created — check your email to verify' };
  }

  @Get('verify-email')
  async verifyEmail(
    @Query('token') token: string,
  ): Promise<{ data: null; message: string }> {
    await this.authService.verifyEmail(token);
    return { data: null, message: 'Email verified — you can now log in' };
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
  ): Promise<{ data: { token: string }; message: string }> {
    const result = await this.authService.login(dto.email, dto.password);
    return { data: result, message: 'Login successful' };
  }

  @Post('forgot-password')
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ data: null; message: string }> {
    await this.authService.forgotPassword(dto.email);
    return { data: null, message: 'If that email exists, a reset link has been sent' };
  }

  @Post('reset-password')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ data: null; message: string }> {
    await this.authService.resetPassword(dto.token, dto.password);
    return { data: null, message: 'Password updated — you can now sign in' };
  }

  @Post('dev-token/:email')
  async devToken(
    @Param('email') email: string,
  ): Promise<{ data: { token: string }; message: string }> {
    const result = await this.authService.devToken(email);
    return { data: result, message: 'Dev login OK' };
  }
}
