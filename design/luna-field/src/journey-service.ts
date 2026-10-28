import type { LunaServices, Echo } from './contracts.ts';
import type { JourneyEcho, JourneyPlace, JourneyCycle } from '../../echo-journey/contract.ts';
import { getLiveLunarData, getLunarMonthName, FULL_MOON_PEAK, SYNODIC, KNOWN_NEW_MOON } from './lunar-engine.ts';

export function getLunationForDate(date: Date = new Date()): number {
  const lunar = getLiveLunarData(date);
  return Math.round((lunar.cycleStart.getTime() / 86400000 + 2440587.5 - KNOWN_NEW_MOON) / SYNODIC);
}

export function getCurrentLunation(): number {
  return getLunationForDate(new Date());
}

export function getCycleInfoForLunation(lunation: number, currentLunation: number = getCurrentLunation()): JourneyCycle {
  const jdStart = KNOWN_NEW_MOON + lunation * SYNODIC;
  const cycleStartDate = new Date((jdStart - 2440587.5) * 86400000);
  const midDate = new Date(cycleStartDate.getTime() + FULL_MOON_PEAK * 86400000);
  const cycleEndDate = new Date(cycleStartDate.getTime() + SYNODIC * 86400000);
  const monthName = getLunarMonthName(midDate);
  const name = `${monthName} Moon`;
  const year = midDate.getUTCFullYear();
  const label = `${name} · ${year}`;

  const startStr = cycleStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = cycleEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const range = `${startStr} – ${endStr}`;

  return {
    id: `lunation-${lunation}`,
    lunation,
    label,
    name,
    monthName,
    year,
    range,
    cycleStart: cycleStartDate.toISOString(),
    cycleEnd: cycleEndDate.toISOString(),
    isCurrent: lunation === currentLunation,
    count: 0
  };
}

/** Read-only projection. Original Echo timestamps/metadata are never written back. */
export function journeyEcho(echo: Echo): JourneyEcho {
  const lunar = getLiveLunarData(new Date(echo.occurredAt));
  const lunation = Math.round((lunar.cycleStart.getTime() / 86400000 + 2440587.5 - KNOWN_NEW_MOON) / SYNODIC);
  const cycleInfo = getCycleInfoForLunation(lunation);
  return {
    id: echo.id,
    title: echo.title,
    kind: 'voice',
    occurredAt: echo.occurredAt,
    duration: echo.duration,
    waveform: echo.waveform,
    availability: 'unknown',
    context: {
      cycleId: `lunation-${lunation}`,
      cycleLabel: `${echo.context?.cycleLabel || cycleInfo.label}`,
      phaseId: echo.context?.phaseId || lunar.phaseId,
      phaseLabel: echo.context?.label || lunar.phaseName
    }
  };
}

export function createJourneyService(services: LunaServices) {
  const owner = services.auth.getUser()?.id;
  const valid = () => Boolean(owner && services.auth.getUser()?.id === owner && !services.isSampleMode?.());
  const storageKey = `luna.echo-journey.place.v1.${owner || 'signed-out'}`;

  const allEchoes = (): JourneyEcho[] => {
    return valid()
      ? services
          .snapshot()
          .echoes.filter(
            (e) =>
              e.kind === 'voice' &&
              e.user_id === owner &&
              e.provenance !== 'synthetic' &&
              Number.isFinite(Date.parse(e.occurredAt))
          )
          .map(journeyEcho)
      : [];
  };

  return {
    owner,
    valid,
    currentLunation(): number {
      return getCurrentLunation();
    },
    currentCycleId(): string {
      return `lunation-${getCurrentLunation()}`;
    },
    items(cycleId?: string): JourneyEcho[] {
      const all = allEchoes();
      if (!cycleId) return all;
      return all.filter((e) => e.context.cycleId === cycleId);
    },
    getCycles(): JourneyCycle[] {
      const currentLun = getCurrentLunation();
      const all = allEchoes();
      const countMap = new Map<number, number>();

      for (const e of all) {
        const lun = Number(e.context.cycleId.replace('lunation-', ''));
        if (Number.isFinite(lun)) {
          countMap.set(lun, (countMap.get(lun) || 0) + 1);
        }
      }

      // Always include current cycle even if 0 recordings
      if (!countMap.has(currentLun)) {
        countMap.set(currentLun, 0);
      }

      // Sort descending (newest lunation first)
      const sortedLunations = Array.from(countMap.keys()).sort((a, b) => b - a);

      return sortedLunations.map((lun) => {
        const info = getCycleInfoForLunation(lun, currentLun);
        info.count = countMap.get(lun) || 0;
        return info;
      });
    },
    async resolve(id: string, signal: AbortSignal, options: { refresh?: boolean } = {}) {
      if (!valid()) return { status: 'authentication-required' as const };
      let echo: Echo;
      try {
        echo = await services.echoes.get(id);
      } catch {
        return { status: 'unavailable' as const };
      }
      if (!valid() || signal.aborted) return { status: 'authentication-required' as const };
      if (echo.user_id !== owner || echo.provenance === 'synthetic') return { status: 'forbidden' as const };
      const url = await services.audio.resolve(echo, { signal, refresh: options.refresh });
      if (!valid() || signal.aborted) {
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
        return { status: 'authentication-required' as const };
      }
      if (url) return { status: 'ready' as const, url };
      return { status: echo.audio_path ? ('retryable-error' as const) : ('unavailable' as const) };
    },
    loadPlace(resume = false): JourneyPlace | null {
      if (!valid()) return null;
      try {
        const p = JSON.parse(localStorage.getItem(storageKey + (resume ? '.resume' : '.bookmark')) || 'null');
        return p &&
          typeof p.echoId === 'string' &&
          Number.isFinite(p.seconds) &&
          p.seconds >= 0 &&
          ['oldest', 'newest'].includes(p.order)
          ? p
          : null;
      } catch {
        return null;
      }
    },
    savePlace(place: JourneyPlace, resume = false): boolean {
      if (!valid() || !place.echoId) return false;
      try {
        localStorage.setItem(
          storageKey + (resume ? '.resume' : '.bookmark'),
          JSON.stringify({
            echoId: place.echoId,
            seconds: place.seconds,
            order: place.order,
            cycleId: place.cycleId
          })
        );
        return true;
      } catch {
        return false;
      }
    },
    clearPlace() {
      if (valid()) {
        localStorage.removeItem(storageKey + '.bookmark');
        localStorage.removeItem(storageKey + '.resume');
      }
    }
  };
}
