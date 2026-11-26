export const MAX_BOOKING_DURATION_HOURS = 4;

interface CalculateBookingPriceInput {
  hourlyPrice: number;
  durationHours: number;
}

export interface BookingPrice {
  hourlyPriceSnapshot: number;
  basePrice: number;
  discountPercentage: 0 | 5 | 10;
  discountAmount: number;
  totalPrice: number;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getBundleDiscountPercentage(
  durationHours: number,
): 0 | 5 | 10 {
  if (durationHours <= 1) return 0;
  if (durationHours === 2) return 5;
  return 10;
}

export function calculateBookingPrice(
  input: CalculateBookingPriceInput,
): BookingPrice {
  const { hourlyPrice, durationHours } = input;

  if (!Number.isFinite(hourlyPrice) || hourlyPrice <= 0) {
    throw new Error('Hourly price must be a valid positive number');
  }

  if (
    !Number.isInteger(durationHours) ||
    durationHours < 1
  ) {
    throw new Error('Duration must be a positive whole number of hours');
  }

  if (durationHours > MAX_BOOKING_DURATION_HOURS) {
    throw new Error('A single booking cannot exceed 4 hours.');
  }

  const basePrice = roundCurrency(hourlyPrice * durationHours);
  const discountPercentage = getBundleDiscountPercentage(durationHours);
  const multiplier = (100 - discountPercentage) / 100;
  const totalPrice = roundCurrency(hourlyPrice * durationHours * multiplier);
  const discountAmount = roundCurrency(basePrice - totalPrice);

  return {
    hourlyPriceSnapshot: hourlyPrice,
    basePrice,
    discountPercentage,
    discountAmount,
    totalPrice,
  };
}
