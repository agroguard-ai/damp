import { Controller, Post, Headers, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { Request } from 'express';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('clerk')
  @HttpCode(HttpStatus.OK)
  async handleClerkWebhook(@Headers() headers: Record<string, string>, @Req() req: Request & { rawBody: Buffer }) {
    await this.webhookService.handleClerkWebhook(req.rawBody, headers);
  }
}
