const ENABLE_DEBUG_LOGS =
  process.env.NEXT_PUBLIC_ENABLE_DEBUG_LOGS === 'true' ||
  process.env.ENABLE_SERVER_DEBUG_LOGS === 'true';

export function devLog(...args: unknown[]) {
  if (ENABLE_DEBUG_LOGS) {
    console.log(...args);
  }
}

export function devWarn(...args: unknown[]) {
  if (ENABLE_DEBUG_LOGS) {
    console.warn(...args);
  }
}

export function devError(...args: unknown[]) {
  if (ENABLE_DEBUG_LOGS) {
    console.error(...args);
  }
}

export function previewValue(
  value: string | null | undefined,
  start = 8,
  end = 6,
) {
  if (!value) return null;

  if (value.length <= start + end) {
    return `${value.slice(0, 3)}...`;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}