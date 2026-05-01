import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { SupabaseService } from '../config/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PlatformConfigService } from '../common/services/platform-config.service';
import { CacheService } from '../common/services/cache.service';

const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

const mockSupabaseService = {
  getClient: jest.fn().mockReturnValue(mockSupabaseClient),
};

const mockNotificationsService = {
  dispatch: jest.fn().mockResolvedValue(undefined),
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: PlatformConfigService, useValue: { reload: jest.fn() } },
        { provide: CacheService, useValue: { del: jest.fn(), get: jest.fn(), set: jest.fn() } },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  describe('approveRestaurant', () => {
    it('should throw NotFoundException when restaurant not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      await expect(
        service.approveRestaurant('nonexistent', 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should approve and notify owner', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'rest-1',
          name: 'Test Restaurant',
          owner_id: 'owner-1',
          status: 'active',
          profiles: { first_name: 'Test', email: 'test@test.com' },
        },
      });

      const result = await service.approveRestaurant('rest-1', 'admin-1');

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Restaurant');
      expect(mockNotificationsService.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'owner-1',
          type: 'system',
          title: 'Restaurant Approved',
        }),
      );
    });
  });

  describe('suspendRestaurant', () => {
    it('should require a reason', async () => {
      await expect(
        service.suspendRestaurant('rest-1', '', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateUserRole', () => {
    it('should reject invalid roles', async () => {
      await expect(
        service.updateUserRole('user-1', 'superuser', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent non-super_admins from promoting to admin', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { role: 'admin' }, // performer is admin, not super_admin
      });

      await expect(
        service.updateUserRole('user-1', 'admin', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStats', () => {
    it('should return platform stats', async () => {
      // Mock all the parallel queries
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValue({ data: null });

      // This tests that getStats doesn't crash
      const result = await service.getStats();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('totalRestaurants');
      expect(result).toHaveProperty('totalUsers');
      expect(result).toHaveProperty('totalRevenue');
    });
  });

  describe('rejectRefund', () => {
    it('should require a reason', async () => {
      await expect(
        service.rejectRefund('refund-1', '', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
