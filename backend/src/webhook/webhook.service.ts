/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { Webhook } from 'svix';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async handleClerkWebhook(payload: Buffer, headers: Record<string, string>) {
    const secret = this.configService.getOrThrow<string>('CLERK_WEBHOOK_SECRET');

    const webhook = new Webhook(secret);
    let event: any;

    try {
      event = webhook.verify(payload.toString(), {
        'svix-id': headers['svix-id'],
        'svix-timestamp': headers['svix-timestamp'],
        'svix-signature': headers['svix-signature'],
      });
    } catch (error: any) {
      this.logger.error('Error verifying webhook:', error);
      throw new BadRequestException('Invalid signature');
    }

    const { id } = event.data;
    const eventType = event.type;

    switch (eventType) {
      case 'user.created':
      case 'user.updated': {
        const emailAddress = event.data.email_addresses?.[0]?.email_address;

        await this.prisma.user.upsert({
          where: { clerkId: id },
          update: { email: emailAddress },
          create: {
            clerkId: id,
            email: emailAddress,
          },
        });
        this.logger.log(`User ${id} synced successfully for event type ${eventType}`);
        break;
      }

      case 'user.deleted':
        try {
          await this.prisma.user.delete({
            where: { clerkId: id },
          });
        } catch (error: any) {
          this.logger.error('Error deleting user:', error);
        }
        break;
    }
  }
}
