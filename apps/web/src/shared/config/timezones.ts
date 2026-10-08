/** Common IANA timezones offered in settings. Default is Europe/Vilnius. */
export const TIMEZONE_OPTIONS: readonly string[] = [
  'Europe/Vilnius',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/Warsaw',
  'Europe/Helsinki',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
];

export function timezoneOptions(current: string): string[] {
  return TIMEZONE_OPTIONS.includes(current) ? [...TIMEZONE_OPTIONS] : [current, ...TIMEZONE_OPTIONS];
}
