import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as bcrypt from 'bcrypt';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { Floor } from '@prisma/client';

const ALLOWED_DOMAIN = 'nrs.gov.ng';
const VERIFY_TTL_HOURS = 24;
const RESET_TTL_MINUTES = 60;

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

const LOGO_DATA_URI = (() => {
  try {
    const buf = readFileSync(join(process.cwd(), 'assets', 'logo.jpeg'));
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
})();

@Injectable()
export class AuthService {
  private readonly resend: Resend;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.resend = new Resend(this.config.resendApiKey);
  }

  private emailShell(body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PK Food</title></head>
<body style="margin:0;padding:0;background:#f4f6f3;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f3;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Header -->
        <tr><td style="background:#1a3830;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
          ${LOGO_DATA_URI ? `<img src="${LOGO_DATA_URI}" alt="PK Food" style="height:56px;width:auto;display:block;margin:0 auto 12px;mix-blend-mode:screen;" />` : ''}
          <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.06em;">PK Food</span>
          <p style="margin:4px 0 0;font-size:12px;color:#a3c4b8;letter-spacing:0.08em;text-transform:uppercase;">PK Canteen · NRS HQ</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e8ede8;border-right:1px solid #e8ede8;">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f0f4f0;border-radius:0 0 12px 12px;border:1px solid #e8ede8;border-top:none;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#888;line-height:1.6;">
            This email was sent by PK Food, the internal ordering platform for NRS HQ.<br>
            If you didn't request this, you can safely ignore it.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private async sendVerificationEmail(email: string, token: string): Promise<void> {
    const link = `${this.config.appUrl}/verify-email?token=${token}`;
    await this.resend.emails.send({
      from: this.config.emailFrom,
      to: email,
      subject: 'Verify your PK Food account',
      html: this.emailShell(`
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Verify your email</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
          Welcome to PK Food! Click the button below to activate your account.
          This link expires in <strong style="color:#374151;">${VERIFY_TTL_HOURS} hours</strong>.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:28px;">
          <a href="${link}" style="display:inline-block;padding:14px 36px;background:#316752;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.02em;">
            Verify email address
          </a>
        </td></tr></table>
        <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;border-top:1px solid #f3f4f6;padding-top:20px;">
          Button not working? Copy and paste this link into your browser:<br>
          <a href="${link}" style="color:#316752;word-break:break-all;">${link}</a>
        </p>
      `),
    });
  }

  async register(email: string, password: string, name: string, phone?: string): Promise<void> {
    const domain = email.split('@')[1];
    if (domain !== ALLOWED_DOMAIN) {
      throw new BadRequestException(
        `Only @${ALLOWED_DOMAIN} email addresses are allowed`,
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && existing.emailVerified) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashed = await bcrypt.hash(password, 12);
    const verifyToken = randomBytes(32).toString('hex');
    const verifyTokenExpiry = new Date(Date.now() + VERIFY_TTL_HOURS * 60 * 60 * 1000);

    if (existing) {
      // Unverified account — refresh token and resend
      await this.prisma.user.update({
        where: { email },
        data: { password: hashed, verifyToken, verifyTokenExpiry, name, phone },
      });
    } else {
      await this.prisma.user.create({
        data: { email, password: hashed, verifyToken, verifyTokenExpiry, name, phone },
      });
    }

    try {
      await this.sendVerificationEmail(email, verifyToken);
    } catch {
      // If email fails and this was a new account, clean up so user can retry
      if (!existing) {
        await this.prisma.user.delete({ where: { email } });
      }
      throw new BadRequestException(
        'Could not send verification email — please try again later',
      );
    }
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return silently — don't reveal account existence
    if (!user || user.emailVerified) return;

    const verifyToken = randomBytes(32).toString('hex');
    const verifyTokenExpiry = new Date(Date.now() + VERIFY_TTL_HOURS * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { email },
      data: { verifyToken, verifyTokenExpiry },
    });

    await this.sendVerificationEmail(email, verifyToken);
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { verifyToken: token } });

    if (!user || !user.verifyTokenExpiry) {
      throw new NotFoundException('Invalid or expired verification link');
    }

    // Idempotent — already verified by a previous call (e.g. double-click, redirect loop)
    if (user.emailVerified) return;

    if (user.verifyTokenExpiry < new Date()) {
      throw new UnauthorizedException('Verification link has expired — please register again');
    }

    // Keep the token in DB so duplicate calls in the same session still find the user
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
  }

  async login(email: string, password: string): Promise<{ token: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return { token: this.jwt.sign(payload) };
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success — never reveal whether an email exists
    if (!user || !user.emailVerified) return;

    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    const link = `${this.config.appUrl}/reset-password?token=${resetToken}`;

    await this.resend.emails.send({
      from: this.config.emailFrom,
      to: email,
      subject: 'Reset your PK Food password',
      html: this.emailShell(`
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Reset your password</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
          We received a request to reset your password. Click the button below to choose a new one.
          This link expires in <strong style="color:#374151;">${RESET_TTL_MINUTES} minutes</strong>.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:28px;">
          <a href="${link}" style="display:inline-block;padding:14px 36px;background:#316752;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.02em;">
            Reset password
          </a>
        </td></tr></table>
        <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;border-top:1px solid #f3f4f6;padding-top:20px;">
          Button not working? Copy and paste this link into your browser:<br>
          <a href="${link}" style="color:#316752;word-break:break-all;">${link}</a>
        </p>
      `),
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { resetToken: token } });

    if (!user || !user.resetTokenExpiry) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    if (user.resetTokenExpiry < new Date()) {
      throw new BadRequestException('Reset link has expired — please request a new one');
    }

    const hashed = await bcrypt.hash(password, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, phone: true, role: true, floor: true, officeNumber: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(
    userId: string,
    name: string,
    phone?: string,
    floor?: Floor,
    officeNumber?: string,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name,
        phone: phone ?? null,
        floor: floor ?? null,
        officeNumber: officeNumber ?? null,
      },
      select: { id: true, email: true, name: true, phone: true, role: true, floor: true, officeNumber: true },
    });
  }

  async devToken(email: string): Promise<{ token: string }> {
    if (!this.config.isDev) throw new ForbiddenException('Not available in production');

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException(`No seeded user with email ${email}`);

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return { token: this.jwt.sign(payload) };
  }
}
