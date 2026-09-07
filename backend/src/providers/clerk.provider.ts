import { createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';

export const ClerkClientProvider = {
  provide: 'ClerkClient',
  useFactory: (configService: ConfigService) => {
    const publishableKey = configService.getOrThrow<string>('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    const secretKey = configService.getOrThrow<string>('CLERK_SECRET_KEY');

    return createClerkClient({
      publishableKey,
      secretKey,
    });
  },
  inject: [ConfigService],
};
