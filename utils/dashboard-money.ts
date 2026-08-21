import type { DashboardMoney } from "~~/types/dashboard";
import { getCurrencyFractionDigits } from "./order.ts";

export function addMoneyAmount(
  target: Map<string, number>,
  currency: string,
  amount: number,
) {
  target.set(currency, (target.get(currency) || 0) + amount);
}

export function roundMoneyAmount(value: number, currency?: string) {
  const factor = 10 ** (getCurrencyFractionDigits(currency) ?? 2);
  const rounded = Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor;
  return value < 0 ? -rounded : rounded;
}

export function moneyRowsFromMap(source?: Map<string, number>): DashboardMoney[] {
  if (!source) return [];

  return [...source.entries()]
    .map(([currency, amount]) => ({
      currency,
      amount: roundMoneyAmount(amount, currency),
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}
