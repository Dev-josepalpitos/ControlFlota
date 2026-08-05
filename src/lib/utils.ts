import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export function formatDateOnly(dateString: string | null): string {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString))
}

export function formatKm(km: number | null): string {
  if (km === null || km === undefined) return '—'
  return new Intl.NumberFormat('es-AR').format(km) + ' km'
}

export function formatMoney(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: currencyCode }).format(amount)
}
