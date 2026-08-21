export interface DashboardTimeZone {
  timeZone: string | null;
  timezoneOffsetMinutes: number;
}

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export function resolveDashboardTimeZone(
  value: string | number | null | undefined,
  fallbackOffsetMinutes = 0,
): DashboardTimeZone {
  if (typeof value === "string" && value.trim()) {
    const timeZone = value.trim();
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
      return { timeZone, timezoneOffsetMinutes: 0 };
    } catch {
      // Fall through to the viewer-provided fixed offset.
    }
  }

  const candidate = typeof value === "number" ? value : fallbackOffsetMinutes;
  const timezoneOffsetMinutes = Number.isFinite(candidate)
    ? Math.min(840, Math.max(-840, Math.trunc(candidate)))
    : 0;
  return { timeZone: null, timezoneOffsetMinutes };
}

export function dashboardDateKey(date: Date, zone: DashboardTimeZone) {
  const { year, month, day } = calendarParts(date, zone);
  return formatDateKey({ year, month, day });
}

export function dashboardDateStartIso(dateKey: string, zone: DashboardTimeZone) {
  const date = parseDateKey(dateKey);
  const wallTime = Date.UTC(date.year, date.month - 1, date.day);
  if (!zone.timeZone) {
    return new Date(wallTime + zone.timezoneOffsetMinutes * 60_000).toISOString();
  }

  let instant = wallTime;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const next =
      wallTime + ianaOffsetMinutes(new Date(instant), zone.timeZone) * 60_000;
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant).toISOString();
}

export function addDashboardCalendarDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return formatDateKey({
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  });
}

export function dashboardWeekday(dateKey: string) {
  const date = parseDateKey(dateKey);
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

export function dashboardDateKeysBetween(startKey: string, endKey: string) {
  const keys: string[] = [];
  let cursor = startKey;
  while (cursor <= endKey && keys.length < 32) {
    keys.push(cursor);
    cursor = addDashboardCalendarDays(cursor, 1);
  }
  return keys;
}

function calendarParts(date: Date, zone: DashboardTimeZone): CalendarDate {
  if (!zone.timeZone) {
    const shifted = new Date(date.getTime() - zone.timezoneOffsetMinutes * 60_000);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
    };
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: numberPart(parts, "year"),
    month: numberPart(parts, "month"),
    day: numberPart(parts, "day"),
  };
}

function ianaOffsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const localAsUtc = Date.UTC(
    numberPart(parts, "year"),
    numberPart(parts, "month") - 1,
    numberPart(parts, "day"),
    numberPart(parts, "hour"),
    numberPart(parts, "minute"),
    numberPart(parts, "second"),
  );
  return Math.round((date.getTime() - localAsUtc) / 60_000);
}

function numberPart(parts: Intl.DateTimeFormatPart[], type: string) {
  return Number(parts.find((part) => part.type === type)?.value || 0);
}

function parseDateKey(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid dashboard date key: ${value}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function formatDateKey(date: CalendarDate) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}
