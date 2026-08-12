import type { DashboardMoney } from "~~/types/dashboard";

export function addMoneyAmount(
  target: Map<string, number>,
  currency: string,
  amount: number,
) {
  target.set(currency, (target.get(currency) || 0) + amount);
}

export function roundMoneyAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function moneyRowsFromMap(source?: Map<string, number>): DashboardMoney[] {
  if (!source) return [];

  return [...source.entries()]
    .map(([currency, amount]) => ({
      currency,
      amount: roundMoneyAmount(amount),
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}
