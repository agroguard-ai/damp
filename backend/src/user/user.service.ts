import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { User } from 'generated/prisma';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findByClerkId(clerkId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      throw new NotFoundException(`User with Clerk ID "${clerkId}" not found in database.`);
    }

    return user;
  }
}
