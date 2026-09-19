const STORE_TIMEZONE = 'Africa/Lagos';

// "HH:mm" in the store's timezone, regardless of what timezone the server runs in.
function currentTime(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: STORE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

export function isWithinStoreHours(openTime: string, closeTime: string, now = new Date()): boolean {
  const nowTime = currentTime(now);
  return nowTime >= openTime && nowTime < closeTime;
}
