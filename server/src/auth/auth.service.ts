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
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';

const ALLOWED_DOMAIN = 'nrs.gov.ng';
const VERIFY_TTL_HOURS = 24;
const RESET_TTL_MINUTES = 60;

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpPort === 465,
      auth: {
        user: this.config.smtpUser,
        pass: this.config.smtpPass,
      },
    });
  }

  async register(email: string, password: string): Promise<void> {
    const domain = email.split('@')[1];
    if (domain !== ALLOWED_DOMAIN) {
      throw new BadRequestException(
        `Only @${ALLOWED_DOMAIN} email addresses are allowed`,
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const hashed = await bcrypt.hash(password, 12);
    const verifyToken = randomBytes(32).toString('hex');
    const verifyTokenExpiry = new Date(Date.now() + VERIFY_TTL_HOURS * 60 * 60 * 1000);

    await this.prisma.user.create({
      data: { email, password: hashed, verifyToken, verifyTokenExpiry },
    });

    const link = `${this.config.appUrl}/verify-email?token=${verifyToken}`;

    await this.transporter.sendMail({
      from: this.config.fromEmail,
      to: email,
      subject: 'Verify your PK Food account',
      html: `
        <h2>PK Food — Verify your email</h2>
        <p>Click the button below to activate your account. The link expires in ${VERIFY_TTL_HOURS} hours.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#316752;color:#fff;text-decoration:none;border-radius:6px;">
          Verify email
        </a>
        <p style="margin-top:16px;color:#666;font-size:12px;">
          If you didn't create an account, ignore this email.
        </p>
      `,
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { verifyToken: token } });

    if (!user || !user.verifyTokenExpiry) {
      throw new NotFoundException('Invalid or expired verification link');
    }
    if (user.verifyTokenExpiry < new Date()) {
      throw new UnauthorizedException('Verification link has expired — please register again');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verifyToken: null, verifyTokenExpiry: null },
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

    await this.transporter.sendMail({
      from: this.config.fromEmail,
      to: email,
      subject: 'Reset your PK Food password',
      html: `
        <h2>PK Food — Password reset</h2>
        <p>Click the button below to set a new password. This link expires in ${RESET_TTL_MINUTES} minutes.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#316752;color:#fff;text-decoration:none;border-radius:6px;">
          Reset password
        </a>
        <p style="margin-top:16px;color:#666;font-size:12px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      `,
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

  async devToken(email: string): Promise<{ token: string }> {
    if (!this.config.isDev) throw new ForbiddenException('Not available in production');

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException(`No seeded user with email ${email}`);

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return { token: this.jwt.sign(payload) };
  }
}
