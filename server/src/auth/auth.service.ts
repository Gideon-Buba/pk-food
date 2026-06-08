import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';

const ALLOWED_DOMAIN = 'nrs.gov.ng';
const MAGIC_LINK_TTL_MINUTES = 15;

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

  async sendMagicLink(email: string): Promise<void> {
    const domain = email.split('@')[1];
    if (domain !== ALLOWED_DOMAIN) {
      throw new BadRequestException(
        `Only @${ALLOWED_DOMAIN} email addresses are allowed`,
      );
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000,
    );

    await this.prisma.magicLink.create({
      data: { email, token, expiresAt },
    });

    const link = `${this.config.appUrl}/auth/callback?token=${token}`;

    await this.transporter.sendMail({
      from: this.config.fromEmail,
      to: email,
      subject: 'Your PK Food login link',
      html: `
        <h2>PK Food — Login</h2>
        <p>Click the link below to log in. It expires in ${MAGIC_LINK_TTL_MINUTES} minutes.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;">
          Log in to PK Food
        </a>
        <p style="margin-top:16px;color:#666;font-size:12px;">
          If you didn't request this, ignore this email.
        </p>
      `,
    });
  }

  async verifyMagicLink(token: string): Promise<{ token: string }> {
    const magicLink = await this.prisma.magicLink.findUnique({
      where: { token },
    });

    if (!magicLink) throw new NotFoundException('Invalid or expired link');
    if (magicLink.used) throw new UnauthorizedException('Link already used');
    if (magicLink.expiresAt < new Date()) {
      throw new UnauthorizedException('Link has expired');
    }

    await this.prisma.magicLink.update({
      where: { id: magicLink.id },
      data: { used: true },
    });

    const user = await this.prisma.user.upsert({
      where: { email: magicLink.email },
      create: { email: magicLink.email },
      update: {},
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const jwtToken = this.jwt.sign(payload);
    return { token: jwtToken };
  }
}
