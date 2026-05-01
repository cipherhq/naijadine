import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsService } from './reservations.service';
import { SupabaseService } from '../config/supabase.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlatformConfigService } from '../common/services/platform-config.service';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  single: jest.fn(),
  rpc: jest.fn(),
};

const mockSupabaseService = {
  getClient: jest.fn().mockReturnValue(mockSupabaseClient),
};

const mockNotificationsService = {
  dispatch: jest.fn().mockResolvedValue(undefined),
};

const mockLoyaltyService = {
  checkTierProgression: jest.fn().mockResolvedValue({ upgraded: false, previousTier: 'bronze', currentTier: 'bronze' }),
};

const mockPlatformConfig = {
  commissionRate: 0.1,
  commissionPercent: 10,
  freeBookingLimit: 50,
  starterBookingLimit: 100,
  noShowStrikeLimit: 4,
  maxPartySize: 20,
  get: jest.fn().mockReturnValue(''),
};

describe('ReservationsService', () => {
  let service: ReservationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: LoyaltyService, useValue: mockLoyaltyService },
        { provide: PlatformConfigService, useValue: mockPlatformConfig },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should reject past booking dates', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await expect(
        service.create(
          {
            restaurant_id: 'test-id',
            date: yesterday.toISOString().split('T')[0],
            time: '19:00',
            party_size: 2,
          } as any,
          'user-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when restaurant not found', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } }); // restaurant
      mockSupabaseClient.single.mockResolvedValueOnce({ data: null }); // subscription

      await expect(
        service.create(
          {
            restaurant_id: 'nonexistent',
            date: tomorrow.toISOString().split('T')[0],
            time: '19:00',
            party_size: 2,
          } as any,
          'user-id',
        ),
      ).rejects.toThrow();
    });
  });

  describe('cancel', () => {
    it('should exist as a method', () => {
      expect(service.cancel).toBeDefined();
      expect(typeof service.cancel).toBe('function');
    });
  });

  describe('modify', () => {
    it('should exist as a method', () => {
      expect(service.modify).toBeDefined();
      expect(typeof service.modify).toBe('function');
    });
  });

  describe('confirm', () => {
    it('should exist as a method', () => {
      expect(service.confirm).toBeDefined();
      expect(typeof service.confirm).toBe('function');
    });
  });

  describe('complete', () => {
    it('should exist as a method', () => {
      expect(service.complete).toBeDefined();
    });
  });

  describe('markNoShow', () => {
    it('should exist as a method', () => {
      expect(service.markNoShow).toBeDefined();
    });
  });
});
