import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { SupabaseService } from '../config/supabase.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PlatformConfigService } from '../common/services/platform-config.service';

const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => mockSupabaseClient },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('') },
        },
        {
          provide: PlatformConfigService,
          useValue: { commissionRate: 0.1, commissionPercent: 10, get: jest.fn().mockReturnValue('') },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should reject when reservation not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({ data: null });

      await expect(
        service.initialize({ reservation_id: 'nonexistent', callback_url: 'http://test.com' } as any, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when deposit already paid', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'res-1',
          user_id: 'user-1',
          deposit_status: 'paid',
          deposit_amount: 2000,
          restaurants: { name: 'Test' },
        },
      });

      await expect(
        service.initialize({ reservation_id: 'res-1', callback_url: 'http://test.com' } as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create mock payment in dev mode', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: {
            id: 'res-1',
            user_id: 'user-1',
            deposit_status: 'pending',
            deposit_amount: 2000,
            reference_code: 'DR-0001',
            restaurants: { name: 'Test', payment_gateway: null },
          },
        })
        .mockResolvedValueOnce({ data: { email: 'test@test.com', phone: '+2341234567890' } }) // profile
        .mockResolvedValueOnce({ data: { id: 'pay-1' } }); // insert payment

      const result = await service.initialize(
        { reservation_id: 'res-1', callback_url: 'http://test.com/callback' } as any,
        'user-1',
      );

      expect(result).toBeDefined();
      // Dev mode creates mock payment
    });
  });

  describe('executePayout', () => {
    it('should reject when payout not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({ data: null });

      await expect(service.executePayout('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should reject when no bank account', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'payout-1',
          net_amount: 10000,
          bank_accounts: { paystack_recipient_code: null },
        },
      });

      await expect(service.executePayout('payout-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('calculatePayout', () => {
    it('should be defined', () => {
      expect(service.calculatePayout).toBeDefined();
    });
  });

  describe('listBanks', () => {
    it('should return mock banks in dev mode', async () => {
      const banks = await service.listBanks();
      expect(banks).toBeInstanceOf(Array);
      expect(banks.length).toBeGreaterThan(0);
      expect(banks[0]).toHaveProperty('name');
      expect(banks[0]).toHaveProperty('code');
    });
  });
});
