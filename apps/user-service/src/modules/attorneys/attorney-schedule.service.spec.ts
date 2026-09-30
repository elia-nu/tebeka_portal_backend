import { Test, TestingModule } from '@nestjs/testing';
import { AttorneyScheduleService } from './services/attorney-schedule.service';
import { PrismaService } from '@workspace/database';
import { NotFoundException } from '@nestjs/common';

describe('AttorneyScheduleService - DB Persistence & Day/Timezone Mapping', () => {
  let service: AttorneyScheduleService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      attorneyProfile: {
        findUnique: jest.fn(),
      },
      availabilityWindow: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      availabilityBlackout: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttorneyScheduleService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AttorneyScheduleService>(AttorneyScheduleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAvailability - PostgreSQL Persistence & Weekday Parsing', () => {
    it('should correctly parse weekday string "WEDNESDAY" to weekday: 3 and persist to DB', async () => {
      mockPrisma.attorneyProfile.findUnique.mockResolvedValue({ id: 'prof-1', userId: 'user-1' });
      mockPrisma.availabilityWindow.create.mockImplementation((args: any) => Promise.resolve({ id: 'win-1', ...args.data }));

      const result = await service.createAvailability('user-1', {
        dayOfWeek: 'WEDNESDAY',
        startTime: '10:00',
        endTime: '16:00',
      });

      expect(mockPrisma.availabilityWindow.create).toHaveBeenCalledWith({
        data: {
          attorneyId: 'prof-1',
          weekday: 3,
          dayOfWeek: 'WEDNESDAY',
          startTime: '10:00',
          endTime: '16:00',
          timezone: 'Africa/Addis_Ababa',
          isAvailable: true,
        },
      });
      expect(result.weekday).toBe(3);
    });

    it('should correctly parse weekday number 2 to Tuesday and persist to DB', async () => {
      mockPrisma.attorneyProfile.findUnique.mockResolvedValue({ id: 'prof-1', userId: 'user-1' });
      mockPrisma.availabilityWindow.create.mockImplementation((args: any) => Promise.resolve({ id: 'win-2', ...args.data }));

      const result = await service.createAvailability('prof-1', {
        weekday: 2,
        startTime: '09:00',
        endTime: '17:00',
      });

      expect(mockPrisma.availabilityWindow.create).toHaveBeenCalledWith({
        data: {
          attorneyId: 'prof-1',
          weekday: 2,
          dayOfWeek: 'Tuesday',
          startTime: '09:00',
          endTime: '17:00',
          timezone: 'Africa/Addis_Ababa',
          isAvailable: true,
        },
      });
      expect(result.dayOfWeek).toBe('Tuesday');
      expect(result.weekday).toBe(2);
    });
  });

  describe('getAvailability - DB Persistence', () => {
    it('should query availabilityWindow records from database for attorney', async () => {
      mockPrisma.attorneyProfile.findUnique.mockResolvedValue({ id: 'prof-1', userId: 'user-1' });
      mockPrisma.availabilityWindow.findMany.mockResolvedValue([
        { id: 'win-1', attorneyId: 'prof-1', weekday: 1, startTime: '09:00', endTime: '17:00' },
      ]);

      const result = await service.getAvailability('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('win-1');
      expect(mockPrisma.availabilityWindow.findMany).toHaveBeenCalledWith({
        where: { attorneyId: 'prof-1' },
        orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
      });
    });

    it('should return empty list if attorney has no availability saved in DB (no hardcoded mocks)', async () => {
      mockPrisma.attorneyProfile.findUnique.mockResolvedValue({ id: 'prof-1', userId: 'user-1' });
      mockPrisma.availabilityWindow.findMany.mockResolvedValue([]);

      const result = await service.getAvailability('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('updateAvailability & deleteAvailability - DB Operations', () => {
    it('should update availability record in DB', async () => {
      mockPrisma.availabilityWindow.findUnique.mockResolvedValue({ id: 'win-1', weekday: 1 });
      mockPrisma.availabilityWindow.update.mockResolvedValue({ id: 'win-1', weekday: 3, dayOfWeek: 'Wednesday', startTime: '11:00' });

      const result = await service.updateAvailability('win-1', { dayOfWeek: 'Wednesday', startTime: '11:00' });
      expect(result.weekday).toBe(3);
      expect(mockPrisma.availabilityWindow.update).toHaveBeenCalled();
    });

    it('should delete availability record from DB', async () => {
      mockPrisma.availabilityWindow.findUnique.mockResolvedValue({ id: 'win-1' });
      mockPrisma.availabilityWindow.delete.mockResolvedValue({ id: 'win-1' });

      const result = await service.deleteAvailability('win-1');
      expect(result.status).toBe('success');
      expect(mockPrisma.availabilityWindow.delete).toHaveBeenCalledWith({ where: { id: 'win-1' } });
    });
  });

  describe('blockDate & setVacation - Blackouts DB Persistence', () => {
    it('should create blackout record in DB for blocked date', async () => {
      mockPrisma.attorneyProfile.findUnique.mockResolvedValue({ id: 'prof-1' });
      mockPrisma.availabilityBlackout.create.mockResolvedValue({ id: 'blk-1' });

      const result = await service.blockDate({ attorneyId: 'prof-1', date: '2026-10-15', reason: 'Court appearance' });
      expect(result.status).toBe('success');
      expect(mockPrisma.availabilityBlackout.create).toHaveBeenCalled();
    });

    it('should create blackout record in DB for vacation', async () => {
      mockPrisma.attorneyProfile.findUnique.mockResolvedValue({ id: 'prof-1' });
      mockPrisma.availabilityBlackout.create.mockResolvedValue({ id: 'blk-2' });

      const result = await service.setVacation({ attorneyId: 'prof-1', startDate: '2026-11-01', endDate: '2026-11-10', reason: 'Holiday' });
      expect(result.status).toBe('success');
      expect(mockPrisma.availabilityBlackout.create).toHaveBeenCalled();
    });
  });
});
