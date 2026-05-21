import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { Webhook } from 'svix';
import { WebhookEvent } from '@clerk/backend';

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
    let event: WebhookEvent;

    try {
      event = webhook.verify(payload.toString(), {
        'svix-id': headers['svix-id'],
        'svix-timestamp': headers['svix-timestamp'],
        'svix-signature': headers['svix-signature'],
      }) as WebhookEvent;
    } catch (error: any) {
      this.logger.error('Error verifying webhook:', error);
      throw new BadRequestException('Invalid signature');
    }

    const eventType = event.type;

    switch (eventType) {
      case 'user.created':
      case 'user.updated': {
        const id = event.data.id;
        const emailAddress = event.data.email_addresses?.[0]?.email_address;

        if (!id || !emailAddress) {
          this.logger.error('Invalid user data');
          break;
        }

        await this.prisma.user.upsert({
          where: { clerk_id: id },
          update: { email: emailAddress },
          create: {
            clerk_id: id,
            email: emailAddress,
          },
        });
        this.logger.log(`User ${id} synced successfully for event type ${eventType}`);
        break;
      }

      case 'user.deleted': {
        const id = event.data.id;
        if (!id) break;
        try {
          await this.prisma.user.delete({
            where: { clerk_id: id },
          });
        } catch (error: any) {
          this.logger.error('Error deleting user:', error);
        }
        break;
      }
    }
  }
}
