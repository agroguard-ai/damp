import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: any;
  let jwtService: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: '',
    name: 'Test User',
    globalRole: 'USER',
    mustChangePassword: true,
    isActive: true,
    maxCollars: 10,
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('TempPassword123!', 10);
  });

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-access-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => (key === 'JWT_SECRET' ? 'test-secret' : '7d')),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should return user with mustChangePassword flag and access token', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'test@example.com',
        password: 'TempPassword123!',
      });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.mustChangePassword).toBe(true);
      expect(result.user.isActive).toBe(true);
      expect(result.user.maxCollars).toBe(10);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-1',
          mustChangePassword: true,
        }),
        expect.anything()
      );
    });

    it('should throw UnauthorizedException on inactive/suspended user', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'TempPassword123!',
        })
      ).rejects.toThrow('Su cuenta se encuentra suspendida o inhabilitada');
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'WrongPassword!',
        })
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('should successfully change password and return updated user with mustChangePassword = false', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        mustChangePassword: false,
      });

      const result = await service.changePassword('user-1', {
        currentPassword: 'TempPassword123!',
        newPassword: 'BrandNewPassword2026!',
      });

      expect(result.user.mustChangePassword).toBe(false);
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            mustChangePassword: false,
          }),
        })
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-1',
          mustChangePassword: false,
        }),
        expect.anything()
      );
    });

    it('should throw UnauthorizedException if current password does not match', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'IncorrectOldPassword!',
          newPassword: 'BrandNewPassword2026!',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException if new password is equal to current password', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'TempPassword123!',
          newPassword: 'TempPassword123!',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('unknown-id', {
          currentPassword: 'TempPassword123!',
          newPassword: 'BrandNewPassword2026!',
        })
      ).rejects.toThrow(NotFoundException);
    });
  });
});
