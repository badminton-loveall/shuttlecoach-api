/**
 * Pure utility functions for Indian Financial Year date range calculations.
 * All functions are side-effect free (no DB calls).
 */

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export interface ParsedFinancialYear {
  startYear: number;
  endYear: number;
}

/**
 * Returns the date range (start and end) for a given month string.
 * @param monthStr - Month in YYYY-MM format
 * @returns DateRange with first and last day of the month
 * @throws Error if format is invalid
 */
export function getMonthRange(monthStr: string): DateRange {
  const match = monthStr.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) {
    throw new Error('Invalid month format. Expected YYYY-MM');
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);

  const start = `${year}-${String(month).padStart(2, '0')}-01`;

  // Last day of month: create date for day 0 of the next month
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return { start, end };
}

/**
 * Returns the date range for a quarter within an Indian financial year.
 * Q1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar
 * @param quarter - Quarter string: Q1, Q2, Q3, or Q4
 * @param financialYear - Financial year in YYYY-YYYY format
 * @returns DateRange for the quarter
 * @throws Error if quarter or financial year is invalid
 */
export function getQuarterRange(quarter: string, financialYear: string): DateRange {
  const validQuarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  if (!validQuarters.includes(quarter)) {
    throw new Error('Invalid quarter. Must be Q1, Q2, Q3, or Q4');
  }

  const { startYear, endYear } = parseFinancialYear(financialYear);

  switch (quarter) {
    case 'Q1':
      return { start: `${startYear}-04-01`, end: `${startYear}-06-30` };
    case 'Q2':
      return { start: `${startYear}-07-01`, end: `${startYear}-09-30` };
    case 'Q3':
      return { start: `${startYear}-10-01`, end: `${startYear}-12-31` };
    case 'Q4':
      return { start: `${endYear}-01-01`, end: `${endYear}-03-31` };
    default:
      throw new Error('Invalid quarter. Must be Q1, Q2, Q3, or Q4');
  }
}

/**
 * Returns the date range for an entire Indian financial year (April 1 to March 31).
 * @param financialYear - Financial year in YYYY-YYYY format (e.g., '2024-2025')
 * @returns DateRange spanning April 1 of start year to March 31 of end year
 * @throws Error if format is invalid or years are not consecutive
 */
export function getFinancialYearRange(financialYear: string): DateRange {
  const { startYear, endYear } = parseFinancialYear(financialYear);

  return {
    start: `${startYear}-04-01`,
    end: `${endYear}-03-31`,
  };
}

/**
 * Validates that fromDate is on or before toDate.
 * @param fromDate - Start date in YYYY-MM-DD format
 * @param toDate - End date in YYYY-MM-DD format
 * @returns true if fromDate <= toDate, false otherwise
 * @throws Error if date format is invalid
 */
export function validateDateRange(fromDate: string, toDate: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!dateRegex.test(fromDate)) {
    throw new Error('Invalid date format for fromDate. Expected YYYY-MM-DD');
  }
  if (!dateRegex.test(toDate)) {
    throw new Error('Invalid date format for toDate. Expected YYYY-MM-DD');
  }

  return fromDate <= toDate;
}

/**
 * Parses and validates a financial year string in YYYY-YYYY format.
 * Ensures end year = start year + 1.
 * @param fy - Financial year string (e.g., '2024-2025')
 * @returns ParsedFinancialYear with startYear and endYear
 * @throws Error if format is invalid or years are not consecutive
 */
export function parseFinancialYear(fy: string): ParsedFinancialYear {
  const match = fy.match(/^(\d{4})-(\d{4})$/);
  if (!match) {
    throw new Error('Invalid financial year format. Expected YYYY-YYYY');
  }

  const startYear = parseInt(match[1], 10);
  const endYear = parseInt(match[2], 10);

  if (endYear !== startYear + 1) {
    throw new Error('Financial year must span consecutive years (e.g., 2024-2025)');
  }

  return { startYear, endYear };
}
