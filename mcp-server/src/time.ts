// Luna Loops - Authoritative Time Grounding (Server-side)
// Authoritative temporal context rooted in America/Chicago with dynamic IANA DST handling

export interface TimeContext {
  timezone: string;
  utcNow: string;
  localNow: string;
  localDate: string; // YYYY-MM-DD
  localTime: string; // HH:mm:ss
  today: string; // YYYY-MM-DD
  yesterday: string; // YYYY-MM-DD
  tomorrow: string; // YYYY-MM-DD
  currentYear: number;
  dayOfWeek: string;
  utcOffset: string; // e.g. "-05:00" (CDT) or "-06:00" (CST)
  isDST: boolean;
  source: 'server_authoritative_clock';
}

export function getTimeContext(
  timezone = 'America/Chicago',
  baseDate: Date = new Date()
): TimeContext {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'long',
    timeZoneName: 'short'
  });

  const parts = formatter.formatToParts(baseDate);
  const partMap: Record<string, string> = {};
  parts.forEach((p) => {
    partMap[p.type] = p.value;
  });

  const year = parseInt(partMap.year, 10);
  const month = partMap.month;
  const day = partMap.day;
  const hour = partMap.hour === '24' ? '00' : partMap.hour;
  const minute = partMap.minute;
  const second = partMap.second;
  const weekday = partMap.weekday;
  const tzAbbr = partMap.timeZoneName || '';

  const localDate = `${year}-${month}-${day}`;
  const localTime = `${hour}:${minute}:${second}`;
  const localNow = `${localDate} ${localTime} ${tzAbbr} (${timezone})`;

  const formatShortDate = (d: Date) => {
    const p = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(d);
    const m: Record<string, string> = {};
    p.forEach((x) => {
      m[x.type] = x.value;
    });
    return `${m.year}-${m.month}-${m.day}`;
  };

  const yesterdayDate = new Date(baseDate.getTime() - 86400000);
  const tomorrowDate = new Date(baseDate.getTime() + 86400000);

  const today = localDate;
  const yesterday = formatShortDate(yesterdayDate);
  const tomorrow = formatShortDate(tomorrowDate);

  const utcYear = baseDate.getUTCFullYear();
  const utcDay = String(baseDate.getUTCDate()).padStart(2, '0');
  const utcHours = baseDate.getUTCHours();
  const utcMinutes = baseDate.getUTCMinutes();

  const localComparableMs = Date.UTC(year, parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10));
  const utcComparableMs = Date.UTC(utcYear, baseDate.getUTCMonth(), parseInt(utcDay, 10), utcHours, utcMinutes);
  const offsetMinutes = Math.round((localComparableMs - utcComparableMs) / 60000);

  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHoursStr = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offsetMinsStr = String(absOffset % 60).padStart(2, '0');
  const utcOffset = `${sign}${offsetHoursStr}:${offsetMinsStr}`;

  const isDST = tzAbbr.includes('DT') || offsetMinutes === -300;

  return {
    timezone,
    utcNow: baseDate.toISOString(),
    localNow,
    localDate,
    localTime,
    today,
    yesterday,
    tomorrow,
    currentYear: year,
    dayOfWeek: weekday,
    utcOffset,
    isDST,
    source: 'server_authoritative_clock'
  };
}
