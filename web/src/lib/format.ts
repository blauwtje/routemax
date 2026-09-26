import { ApiError } from './api-client';

const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function formatUsd(amount: number): string {
  return usdFormat.format(amount);
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : timeFormat.format(date);
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'The routemax ui server did not answer. Check that it is still running.';
}
