interface CalculateBookingPriceInput {
  hourlyPrice: number;
  durationHours: number;
}

interface BookingPrice {
  hourlyPriceSnapshot: number;
  totalPrice: number;
}

export function calculateBookingPrice(
  input: CalculateBookingPriceInput,
): BookingPrice {
  const { hourlyPrice, durationHours } = input;

  if (!Number.isFinite(hourlyPrice) || hourlyPrice < 0) {
    throw new Error('Hourly price must be a valid non-negative number');
  }

  if (
    !Number.isInteger(durationHours) ||
    durationHours < 1
  ) {
    throw new Error('Duration must be a positive whole number of hours');
  }

  const total = hourlyPrice * durationHours;

  const totalPrice =
    Math.round((total + Number.EPSILON) * 100) / 100;

  return {
    hourlyPriceSnapshot: hourlyPrice,
    totalPrice,
  };
}