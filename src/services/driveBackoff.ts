/**
 * Google Drive API Weighted Units Quota & Rate Limit Handler
 * Implements Full Jitter Exponential Backoff for HTTP 403 (Rate/Quota Limit Exceeded)
 * and HTTP 429 (Too Many Requests), plus transient 5xx errors and network hiccups.
 */

export interface BackoffOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOn401?: boolean;
  onRetry?: (attempt: number, delayMs: number, reason: string) => void;
}

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 32000;

/**
 * Calculates exponential backoff with full jitter according to Google's standard algorithm:
 * JitteredDelay = Math.random() * Math.min(maxDelay, baseDelay * 2^attempt)
 */
export function calculateJitterDelay(
  attempt: number,
  baseDelayMs: number = DEFAULT_BASE_DELAY_MS,
  maxDelayMs: number = DEFAULT_MAX_DELAY_MS
): number {
  const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
  // Full jitter provides uniform distribution across [0, exponentialDelay] with a minimum floor
  const minFloor = Math.min(300, exponentialDelay * 0.2);
  const jittered = minFloor + Math.random() * (exponentialDelay - minFloor);
  return Math.floor(jittered);
}

/**
 * Parses Retry-After header if returned by Google API (in seconds or HTTP Date)
 */
function parseRetryAfter(response: Response): number | null {
  const retryAfterHeader = response.headers.get('Retry-After');
  if (!retryAfterHeader) return null;

  const seconds = parseInt(retryAfterHeader, 10);
  if (!isNaN(seconds) && seconds > 0) {
    return (seconds * 1000) + Math.floor(Math.random() * 500); // add small jitter
  }

  const dateMs = Date.parse(retryAfterHeader);
  if (!isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    if (diff > 0) return diff + Math.floor(Math.random() * 500);
  }

  return null;
}

/**
 * Determines whether an HTTP error or response is retryable under Google's Weighted Units quota
 */
export async function isDriveRateLimitOrRetryable(response: Response): Promise<{ retryable: boolean; reason: string }> {
  const status = response.status;

  // 1. HTTP 429 Too Many Requests is always retryable
  if (status === 429) {
    return { retryable: true, reason: '429 Too Many Requests (Google Quota Limit)' };
  }

  // 2. HTTP 500, 502, 503, 504 are transient Google backend server errors
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return { retryable: true, reason: `${status} Transient Server Error` };
  }

  // 3. HTTP 403: Check if reason is rate limit or quota exceeded
  if (status === 403) {
    try {
      const cloned = response.clone();
      const body = await cloned.json();
      const errors = body?.error?.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        const firstReason = errors[0]?.reason || '';
        const rateLimitReasons = [
          'rateLimitExceeded',
          'userRateLimitExceeded',
          'quotaExceeded',
          'dailyLimitExceeded',
          'cannotDownloadFile',
          'usageLimits.rateLimitExceeded',
          'usageLimits.userRateLimitExceeded'
        ];
        if (rateLimitReasons.some(r => firstReason.toLowerCase().includes(r.toLowerCase()))) {
          return { retryable: true, reason: `403 Quota/Rate Limit: ${firstReason}` };
        }
      }

      // Check message text
      const message = (body?.error?.message || '').toLowerCase();
      if (
        message.includes('quota') ||
        message.includes('rate limit') ||
        message.includes('too many') ||
        message.includes('exceeded')
      ) {
        return { retryable: true, reason: `403 Quota Message: ${message}` };
      }
    } catch {
      // If parsing fails but status is 403, consider safe retry once
      return { retryable: true, reason: '403 Unknown Quota Limit' };
    }
  }

  return { retryable: false, reason: `Non-retryable status ${status}` };
}

/**
 * Universal fetch wrapper executing Full Jitter Exponential Backoff
 */
export async function fetchWithDriveBackoff(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: BackoffOptions = {}
): Promise<Response> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(input, init);

      if (response.ok || response.status === 206 || response.status === 304) {
        return response;
      }

      // Handle token expiration (HTTP 401) by silently refreshing and retrying once
      if (response.status === 401 && attempt === 0) {
        try {
          const { authService } = await import('./authService');
          const newToken = await authService.refreshAccessTokenSilently();
          if (newToken && init) {
            const currentHeaders = new Headers(init.headers || {});
            currentHeaders.set('Authorization', `Bearer ${newToken}`);
            init = { ...init, headers: currentHeaders };
            console.log('[Drive Backoff] HTTP 401 detected: silently refreshed token and retrying request seamlessly.');
            continue;
          }
        } catch (authErr) {
          console.warn('[Drive Backoff] Token refresh on 401 failed:', authErr);
        }
      }

      const { retryable, reason } = await isDriveRateLimitOrRetryable(response);

      if (retryable && attempt < maxRetries) {
        const retryAfter = parseRetryAfter(response);
        const delayMs = retryAfter ?? calculateJitterDelay(attempt, baseDelayMs, maxDelayMs);

        console.warn(`[Drive Backoff] Retrying request (Attempt ${attempt + 1}/${maxRetries}) after ${delayMs}ms due to: ${reason}`);
        if (options.onRetry) {
          options.onRetry(attempt + 1, delayMs, reason);
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      return response;
    } catch (networkError: any) {
      lastError = networkError;
      if (attempt < maxRetries) {
        const delayMs = calculateJitterDelay(attempt, baseDelayMs, maxDelayMs);
        console.warn(`[Drive Backoff] Network failure (Attempt ${attempt + 1}/${maxRetries}), retrying in ${delayMs}ms:`, networkError.message);
        if (options.onRetry) {
          options.onRetry(attempt + 1, delayMs, networkError.message || 'Network error');
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        break;
      }
    }
  }

  throw lastError || new Error(`Google Drive API request failed after ${maxRetries} backoff attempts.`);
}
