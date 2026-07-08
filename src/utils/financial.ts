/**
 * Financial Calculation Utilities
 * 
 * Provides functions for calculating financial summaries and period-based breakdowns
 * for coach income and expenses.
 */

import { FeeRecord, FeeStatus } from '../types';

/**
 * Expense record interface for coach operational costs
 */
export interface Expense {
  id: string;
  coachId: string;
  type: 'SHUTTLE' | 'SUPPLIES' | 'TRAVEL' | 'OTHER';
  amount: number;
  date: Date;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * Financial summary with total calculations
 */
export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
}

/**
 * Period-based financial breakdown
 */
export interface PeriodBreakdown {
  period: 'MONTH' | 'QUARTER' | 'YEAR';
  label: string;
  income: number;
  expenses: number;
  net: number;
}

/**
 * Comprehensive financial data with period breakdowns
 */
export interface FinancialData {
  summary: FinancialSummary;
  breakdowns: PeriodBreakdown[];
}

/**
 * Calculate financial summary for coach
 * 
 * Computes total income from fees (only PAID status), total expenses, and net balance.
 * 
 * @param fees - Array of fee records
 * @param expenses - Array of expense records
 * @returns FinancialSummary with totalIncome, totalExpenses, and netBalance
 * 
 * **Validates: Requirements 12.4, 16.1**
 */
export const calculateFinancialSummary = (
  fees: FeeRecord[],
  expenses: Expense[]
): FinancialSummary => {
  // Calculate total income from paid fees only
  const totalIncome = fees
    .filter((fee) => fee.status === FeeStatus.PAID)
    .reduce((sum, fee) => sum + fee.amount, 0);

  // Calculate total expenses
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Calculate net balance
  const netBalance = totalIncome - totalExpenses;

  return {
    totalIncome: parseFloat(totalIncome.toFixed(2)),
    totalExpenses: parseFloat(totalExpenses.toFixed(2)),
    netBalance: parseFloat(netBalance.toFixed(2)),
  };
};

/**
 * Get the period label for a given month and year
 * 
 * @param year - Year (e.g., 2026)
 * @param monthIndex - Month index (0-11, where 0 = January)
 * @returns Human-readable month label (e.g., "January 2026")
 */
const getMonthLabel = (year: number, monthIndex: number): string => {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${months[monthIndex]} ${year}`;
};

/**
 * Get the quarter label for a given quarter and year
 * 
 * @param year - Year (e.g., 2026)
 * @param quarter - Quarter number (1-4)
 * @returns Human-readable quarter label (e.g., "Q1 2026")
 */
const getQuarterLabel = (year: number, quarter: number): string => {
  return `Q${quarter} ${year}`;
};

/**
 * Check if a date falls within a specific month
 * 
 * @param date - Date to check
 * @param year - Year
 * @param monthIndex - Month index (0-11)
 * @returns true if date is in the specified month
 */
const isDateInMonth = (date: Date, year: number, monthIndex: number): boolean => {
  const dateObj = new Date(date);
  return dateObj.getFullYear() === year && dateObj.getMonth() === monthIndex;
};

/**
 * Get quarter number from month index
 * 
 * @param monthIndex - Month index (0-11)
 * @returns Quarter number (1-4)
 */
const getQuarterFromMonth = (monthIndex: number): number => {
  return Math.floor(monthIndex / 3) + 1;
};

/**
 * Check if a date falls within a specific quarter
 * 
 * @param date - Date to check
 * @param year - Year
 * @param quarter - Quarter number (1-4)
 * @returns true if date is in the specified quarter
 */
const isDateInQuarter = (date: Date, year: number, quarter: number): boolean => {
  const dateObj = new Date(date);
  if (dateObj.getFullYear() !== year) {
    return false;
  }
  const dateQuarter = getQuarterFromMonth(dateObj.getMonth());
  return dateQuarter === quarter;
};

/**
 * Calculate financial breakdowns by period (monthly, quarterly, yearly)
 * 
 * Returns summaries for the current year including:
 * - All 12 months (even those with zero transactions)
 * - All 4 quarters (even those with zero transactions)
 * - Year-to-date total
 * 
 * @param fees - Array of fee records
 * @param expenses - Array of expense records
 * @returns Array of PeriodBreakdown objects sorted by period type
 * 
 * **Validates: Requirements 12.4, 16.1, 20.1**
 */
export const calculatePeriodBreakdowns = (
  fees: FeeRecord[],
  expenses: Expense[]
): PeriodBreakdown[] => {
  const currentYear = new Date().getFullYear();
  const breakdowns: PeriodBreakdown[] = [];

  // Calculate monthly breakdowns for all 12 months
  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const monthIncome = fees
      .filter(
        (fee) => fee.status === FeeStatus.PAID && isDateInMonth(new Date(fee.paidDate || fee.createdAt), currentYear, monthIndex)
      )
      .reduce((sum, fee) => sum + fee.amount, 0);

    const monthExpenses = expenses
      .filter((expense) => isDateInMonth(new Date(expense.date), currentYear, monthIndex))
      .reduce((sum, expense) => sum + expense.amount, 0);

    breakdowns.push({
      period: 'MONTH',
      label: getMonthLabel(currentYear, monthIndex),
      income: parseFloat(monthIncome.toFixed(2)),
      expenses: parseFloat(monthExpenses.toFixed(2)),
      net: parseFloat((monthIncome - monthExpenses).toFixed(2)),
    });
  }

  // Calculate quarterly breakdowns for all 4 quarters
  for (let quarter = 1; quarter <= 4; quarter++) {
    const quarterIncome = fees
      .filter(
        (fee) => fee.status === FeeStatus.PAID && isDateInQuarter(new Date(fee.paidDate || fee.createdAt), currentYear, quarter)
      )
      .reduce((sum, fee) => sum + fee.amount, 0);

    const quarterExpenses = expenses
      .filter((expense) => isDateInQuarter(new Date(expense.date), currentYear, quarter))
      .reduce((sum, expense) => sum + expense.amount, 0);

    breakdowns.push({
      period: 'QUARTER',
      label: getQuarterLabel(currentYear, quarter),
      income: parseFloat(quarterIncome.toFixed(2)),
      expenses: parseFloat(quarterExpenses.toFixed(2)),
      net: parseFloat((quarterIncome - quarterExpenses).toFixed(2)),
    });
  }

  // Calculate year-to-date breakdown
  const yearIncome = fees
    .filter(
      (fee) => fee.status === FeeStatus.PAID && new Date(fee.paidDate || fee.createdAt).getFullYear() === currentYear
    )
    .reduce((sum, fee) => sum + fee.amount, 0);

  const yearExpenses = expenses
    .filter((expense) => new Date(expense.date).getFullYear() === currentYear)
    .reduce((sum, expense) => sum + expense.amount, 0);

  breakdowns.push({
    period: 'YEAR',
    label: `Year-to-Date ${currentYear}`,
    income: parseFloat(yearIncome.toFixed(2)),
    expenses: parseFloat(yearExpenses.toFixed(2)),
    net: parseFloat((yearIncome - yearExpenses).toFixed(2)),
  });

  return breakdowns;
};

/**
 * Get complete financial data with summary and period breakdowns
 * 
 * Combines summary calculations with period-based breakdowns into a single object.
 * 
 * @param fees - Array of fee records
 * @param expenses - Array of expense records
 * @returns FinancialData with both summary and breakdowns
 * 
 * **Validates: Requirements 12.4, 16.1, 20.1**
 */
export const getFinancialData = (
  fees: FeeRecord[],
  expenses: Expense[]
): FinancialData => {
  return {
    summary: calculateFinancialSummary(fees, expenses),
    breakdowns: calculatePeriodBreakdowns(fees, expenses),
  };
};
