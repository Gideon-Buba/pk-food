import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendMagicLinkDto } from './dto/send-magic-link.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('magic-link')
  async sendMagicLink(
    @Body() dto: SendMagicLinkDto,
  ): Promise<{ data: null; message: string }> {
    await this.authService.sendMagicLink(dto.email);
    return { data: null, message: 'Magic link sent — check your email' };
  }

  @Get('verify')
  async verify(
    @Query('token') token: string,
  ): Promise<{ data: { token: string }; message: string }> {
    const result = await this.authService.verifyMagicLink(token);
    return { data: result, message: 'Login successful' };
  }
}
