import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireHousehold } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { prisma } from '../utils/prisma';
import { ERROR_CODES } from '@otter-money/shared';
import { Decimal } from '@prisma/client/runtime/library';
import {
  getVehicleValue,
  decodeVin,
  isMarketCheckConfigured,
  getAllMakes,
  getModelsForMakeYear,
  getTrimsForMakeModelYear,
  findVinForVehicle,
} from '../services/marketcheck';

export const vehiclesRouter = Router();

vehiclesRouter.use(authenticate);
vehiclesRouter.use(requireHousehold);

// VIN regex: 17 chars, no I, O, Q
const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i;

// Validation schemas
const createVehicleSchema = z.object({
  vin: z.string().regex(vinRegex, 'Invalid VIN format').optional(),
  year: z.number().int().min(1900).max(2100),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  trim: z.string().max(100).optional(),
  mileage: z.number().int().min(0),
  zipCode: z.string().min(5).max(10),
  purchasePrice: z.number().min(0).optional(),
  purchaseDate: z.string().optional(),
  ownerId: z.string().nullable().optional(),
  name: z.string().max(100).optional(),
});

const updateVehicleSchema = z.object({
  trim: z.string().max(100).optional(),
  zipCode: z.string().min(5).max(10).optional(),
  ownerId: z.string().nullable().optional(),
  name: z.string().max(100).optional(),
});

const updateMileageSchema = z.object({
  mileage: z.number().int().positive(),
});

// Helper: verify vehicle belongs to household
async function getHouseholdVehicle(vehicleId: string, householdId: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      account: {
        include: {
          owner: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      valuations: {
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
  });

  if (!vehicle) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Vehicle not found', 404);
  }

  if (vehicle.householdId !== householdId) {
    throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
  }

  return vehicle;
}

// Helper: transform vehicle for JSON response
function transformVehicle(vehicle: any) {
  const latestValuation = vehicle.valuations?.[0] || null;
  return {
    id: vehicle.id,
    householdId: vehicle.householdId,
    accountId: vehicle.accountId,
    vin: vehicle.vin,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim,
    mileage: vehicle.mileage,
    zipCode: vehicle.zipCode,
    purchasePrice: vehicle.purchasePrice ? Number(vehicle.purchasePrice) : null,
    purchaseDate: vehicle.purchaseDate
      ? vehicle.purchaseDate.toISOString().split('T')[0]
      : null,
    lastValuationAt: vehicle.lastValuationAt
      ? vehicle.lastValuationAt.toISOString()
      : null,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
    account: {
      id: vehicle.account.id,
      name: vehicle.account.name,
      currentBalance: Number(vehicle.account.currentBalance),
      ownerId: vehicle.account.ownerId,
    },
    owner: vehicle.account.owner || null,
    latestValuation: latestValuation
      ? {
          id: latestValuation.id,
          vehicleId: latestValuation.vehicleId,
          date: latestValuation.date.toISOString().split('T')[0],
          mileageAtValuation: latestValuation.mileageAtValuation,
          marketValue: Number(latestValuation.marketValue),
          msrp: latestValuation.msrp ? Number(latestValuation.msrp) : null,
          createdAt: latestValuation.createdAt.toISOString(),
        }
      : null,
  };
}

function transformValuation(v: any) {
  return {
    id: v.id,
    vehicleId: v.vehicleId,
    date: v.date.toISOString().split('T')[0],
    mileageAtValuation: v.mileageAtValuation,
    marketValue: Number(v.marketValue),
    msrp: v.msrp ? Number(v.msrp) : null,
    createdAt: v.createdAt.toISOString(),
  };
}

// ============================================
// ROUTES
// ============================================

// Decode VIN (uses free NHTSA API, no MarketCheck quota)
vehiclesRouter.post('/decode-vin', async (req, res, next) => {
  try {
    const { vin } = z.object({ vin: z.string().regex(vinRegex) }).parse(req.body);
    const result = await decodeVin(vin);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// Get all vehicle makes (NHTSA, free, cached 24h)
vehiclesRouter.get('/makes', async (_req, res, next) => {
  try {
    const makes = await getAllMakes();
    res.json({ data: makes });
  } catch (err) {
    next(err);
  }
});

// Get models for a given make + year (NHTSA, free, cached 24h)
vehiclesRouter.get('/models', async (req, res, next) => {
  try {
    const make = req.query.make as string;
    const yearStr = req.query.year as string;

    if (!make || !yearStr) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'make and year query parameters are required',
        400
      );
    }

    const year = parseInt(yearStr, 10);
    if (isNaN(year) || year < 1900 || year > 2100) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'year must be a number between 1900 and 2100',
        400
      );
    }

    const models = await getModelsForMakeYear(make, year);
    res.json({ data: models });
  } catch (err) {
    next(err);
  }
});

// Get trims for a given make + model + year (MarketCheck facets, cached 24h)
vehiclesRouter.get('/trims', async (req, res, next) => {
  try {
    const make = req.query.make as string;
    const model = req.query.model as string;
    const yearStr = req.query.year as string;

    if (!make || !model || !yearStr) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'make, model, and year query parameters are required',
        400
      );
    }

    const year = parseInt(yearStr, 10);
    if (isNaN(year) || year < 1900 || year > 2100) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'year must be a number between 1900 and 2100',
        400
      );
    }

    const trims = await getTrimsForMakeModelYear(make, model, year);
    res.json({ data: trims });
  } catch (err) {
    next(err);
  }
});

// List household vehicles
vehiclesRouter.get('/', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const vehicles = await prisma.vehicle.findMany({
      where: { householdId },
      include: {
        account: {
          include: {
            owner: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        valuations: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: vehicles.map(transformVehicle) });
  } catch (err) {
    next(err);
  }
});

// Get single vehicle with details
vehiclesRouter.get('/:id', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    const vehicle = await getHouseholdVehicle(req.params.id, householdId);
    res.json({ data: transformVehicle(vehicle) });
  } catch (err) {
    next(err);
  }
});

// Create vehicle
vehiclesRouter.post('/', async (req, res, next) => {
  try {
    const data = createVehicleSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Determine the VIN to store
    // If no VIN provided, generate a placeholder (NOVIN + random chars)
    let storedVin: string;
    if (data.vin) {
      storedVin = data.vin.toUpperCase();

      // Check for duplicate VIN in household
      const existing = await prisma.vehicle.findUnique({
        where: { householdId_vin: { householdId, vin: storedVin } },
      });
      if (existing) {
        throw new AppError(
          ERROR_CODES.CONFLICT,
          'A vehicle with this VIN already exists in your household',
          409
        );
      }
    } else {
      // Generate a unique placeholder VIN (17 chars to satisfy DB constraint)
      const rand = Math.random().toString(36).substring(2, 12).toUpperCase().replace(/[IOQ]/g, 'X');
      storedVin = ('NOVIN' + rand).substring(0, 17).padEnd(17, '0');
    }

    const accountName =
      data.name || `${data.year} ${data.make} ${data.model}`;

    // Create account + vehicle in a transaction
    const [account, vehicle] = await prisma.$transaction(async (tx) => {
      const acc = await tx.account.create({
        data: {
          householdId,
          ownerId: data.ownerId ?? null,
          name: accountName,
          type: 'ASSET',
          subtype: 'vehicle',
          connectionType: 'MANUAL',
          currentBalance: new Decimal(data.purchasePrice || 0),
          availableBalance: new Decimal(data.purchasePrice || 0),
        },
      });

      const veh = await tx.vehicle.create({
        data: {
          householdId,
          accountId: acc.id,
          vin: storedVin,
          year: data.year,
          make: data.make,
          model: data.model,
          trim: data.trim || null,
          mileage: data.mileage,
          zipCode: data.zipCode,
          purchasePrice: data.purchasePrice
            ? new Decimal(data.purchasePrice)
            : null,
          purchaseDate: data.purchaseDate
            ? new Date(data.purchaseDate)
            : null,
        },
      });

      return [acc, veh];
    });

    // Attempt initial valuation (non-blocking — vehicle is created even if this fails)
    let valuation = null;
    try {
      if (isMarketCheckConfigured()) {
        // If no real VIN provided, look up a representative VIN from MarketCheck listings
        let valuationVin = data.vin ? storedVin : null;
        if (!valuationVin) {
          valuationVin = await findVinForVehicle(
            data.year,
            data.make,
            data.model,
            data.trim
          );
        }

        if (!valuationVin) {
          console.warn('Could not find a VIN for valuation — skipping initial pricing');
        } else {
          const priceResult = await getVehicleValue(
            valuationVin,
            data.mileage,
            data.zipCode
          );

          const [newValuation] = await prisma.$transaction([
            prisma.vehicleValuation.create({
              data: {
                vehicleId: vehicle.id,
                date: new Date(),
                mileageAtValuation: data.mileage,
                marketValue: new Decimal(priceResult.marketValue),
                msrp: priceResult.msrp ? new Decimal(priceResult.msrp) : null,
                rawResponse: priceResult.rawResponse as any,
              },
            }),
            prisma.vehicle.update({
              where: { id: vehicle.id },
              data: { lastValuationAt: new Date() },
            }),
            prisma.transaction.create({
              data: {
                accountId: account.id,
                date: new Date(),
                amount: new Decimal(
                  priceResult.marketValue - (data.purchasePrice || 0)
                ),
                description: 'Initial vehicle valuation',
                isManual: true,
                isAdjustment: true,
              },
            }),
            prisma.account.update({
              where: { id: account.id },
              data: {
                currentBalance: new Decimal(priceResult.marketValue),
                availableBalance: new Decimal(priceResult.marketValue),
              },
            }),
          ]);
          valuation = newValuation;
        }
      }
    } catch (err) {
      console.warn('Initial vehicle valuation failed (vehicle still created):', err);
    }

    // Re-fetch the full vehicle with relations
    const fullVehicle = await getHouseholdVehicle(vehicle.id, householdId);
    res.status(201).json({ data: transformVehicle(fullVehicle) });
  } catch (err) {
    next(err);
  }
});

// Update vehicle info
vehiclesRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = updateVehicleSchema.parse(req.body);
    const householdId = req.user!.householdId!;
    const existing = await getHouseholdVehicle(req.params.id, householdId);

    const vehicleUpdate: any = {};
    const accountUpdate: any = {};

    if (data.trim !== undefined) vehicleUpdate.trim = data.trim;
    if (data.zipCode !== undefined) vehicleUpdate.zipCode = data.zipCode;
    if (data.ownerId !== undefined) accountUpdate.ownerId = data.ownerId;
    if (data.name !== undefined) accountUpdate.name = data.name;

    await prisma.$transaction([
      ...(Object.keys(vehicleUpdate).length > 0
        ? [prisma.vehicle.update({ where: { id: req.params.id }, data: vehicleUpdate })]
        : []),
      ...(Object.keys(accountUpdate).length > 0
        ? [prisma.account.update({ where: { id: existing.accountId }, data: accountUpdate })]
        : []),
    ]);

    const updated = await getHouseholdVehicle(req.params.id, householdId);
    res.json({ data: transformVehicle(updated) });
  } catch (err) {
    next(err);
  }
});

// Delete vehicle + account
vehiclesRouter.delete('/:id', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    const vehicle = await getHouseholdVehicle(req.params.id, householdId);

    await prisma.$transaction([
      prisma.vehicleValuation.deleteMany({ where: { vehicleId: vehicle.id } }),
      prisma.vehicle.delete({ where: { id: vehicle.id } }),
      prisma.transaction.deleteMany({ where: { accountId: vehicle.accountId } }),
      prisma.account.delete({ where: { id: vehicle.accountId } }),
    ]);

    res.json({ data: { message: 'Vehicle deleted' } });
  } catch (err) {
    next(err);
  }
});

// Update mileage + trigger fresh valuation
vehiclesRouter.post('/:id/update-mileage', async (req, res, next) => {
  try {
    const data = updateMileageSchema.parse(req.body);
    const householdId = req.user!.householdId!;
    const vehicle = await getHouseholdVehicle(req.params.id, householdId);

    if (data.mileage < vehicle.mileage) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        `New mileage (${data.mileage}) cannot be less than current mileage (${vehicle.mileage})`,
        400
      );
    }

    const previousBalance = Number(vehicle.account.currentBalance);

    // For vehicles without a real VIN, look up a representative one
    let valuationVin = vehicle.vin;
    if (valuationVin.startsWith('NOVIN')) {
      const foundVin = await findVinForVehicle(
        vehicle.year,
        vehicle.make,
        vehicle.model,
        vehicle.trim || undefined
      );
      if (!foundVin) {
        throw new AppError(
          ERROR_CODES.MARKETCHECK_ERROR,
          'Could not find matching vehicle listings for valuation',
          422
        );
      }
      valuationVin = foundVin;
    }

    const priceResult = await getVehicleValue(
      valuationVin,
      data.mileage,
      vehicle.zipCode
    );

    const difference = priceResult.marketValue - previousBalance;

    await prisma.$transaction([
      prisma.vehicleValuation.create({
        data: {
          vehicleId: vehicle.id,
          date: new Date(),
          mileageAtValuation: data.mileage,
          marketValue: new Decimal(priceResult.marketValue),
          msrp: priceResult.msrp ? new Decimal(priceResult.msrp) : null,
          rawResponse: priceResult.rawResponse as any,
        },
      }),
      prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          mileage: data.mileage,
          lastValuationAt: new Date(),
        },
      }),
      prisma.transaction.create({
        data: {
          accountId: vehicle.accountId,
          date: new Date(),
          amount: new Decimal(difference),
          description: `Vehicle valuation update (${data.mileage.toLocaleString()} mi)`,
          isManual: true,
          isAdjustment: true,
        },
      }),
      prisma.account.update({
        where: { id: vehicle.accountId },
        data: {
          currentBalance: new Decimal(priceResult.marketValue),
          availableBalance: new Decimal(priceResult.marketValue),
        },
      }),
    ]);

    const updated = await getHouseholdVehicle(vehicle.id, householdId);
    const transformed = transformVehicle(updated);

    res.json({
      data: {
        ...transformed,
        previousValue: previousBalance,
        valueChange: difference,
        valueChangePercent:
          previousBalance > 0
            ? ((difference / previousBalance) * 100)
            : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Valuation history (for chart)
vehiclesRouter.get('/:id/valuations', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    const vehicle = await getHouseholdVehicle(req.params.id, householdId);

    const limit = Math.min(
      parseInt(req.query.limit as string) || 48,
      100
    );

    const valuations = await prisma.vehicleValuation.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { date: 'asc' },
      take: limit,
    });

    res.json({ data: valuations.map(transformValuation) });
  } catch (err) {
    next(err);
  }
});
