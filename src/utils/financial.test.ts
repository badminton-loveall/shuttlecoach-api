/**
 * Unit Tests for Financial Calculations
 * 
 * Tests for calculateFinancialSummary and calculatePeriodBreakdowns functions
 * Validates accurate arithmetic for various financial scenarios.
 * 
 * Run with: npx ts-node --transpile-only src/utils/financial.test.ts
 * 
 * **Validates: Requirements 12.4, 16.1, 20.1**
 */

import { 
  calculateFinancialSummary, 
  calculatePeriodBreakdowns, 
  getFinancialData,
  Expense,
} from './financial';
import { FeeRecord, FeeStatus, PaymentMethod } from '../types';

// ===== Test Fixtures =====

/**
 * Create a mock fee record for testing
 */
const createMockFee = (overrides: Partial<FeeRecord> = {}): FeeRecord => ({
  id: 'fee-1',
  studentId: 'student-1',
  amount: 1000,
  monthYear: 'January 2026',
  dueDate: new Date('2026-01-15'),
  paidDate: new Date('2026-01-10'),
  status: FeeStatus.PAID,
  paymentMethod: PaymentMethod.UPI,
  transactionRef: 'TXN-001',
  notes: 'Payment received',
  createdAt: new Date('2026-01-10'),
  updatedAt: new Date('2026-01-10'),
  ...overrides,
});

/**
 * Create a mock expense record for testing
 */
const createMockExpense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'exp-1',
  coachId: 'coach-1',
  type: 'SHUTTLE',
  amount: 500,
  date: new Date('2026-01-05'),
  description: 'Shuttle service for practice',
  createdAt: new Date('2026-01-05'),
  updatedAt: new Date('2026-01-05'),
  createdBy: 'admin-1',
  ...overrides,
});

// ===== Test Runners =====

let passCount = 0;
let failCount = 0;

const test = (name: string, fn: () => void): void => {
  try {
    fn();
    console.log(`✓ ${name}`);
    passCount++;
  } catch (error: unknown) {
    console.log(`✗ ${name}`);
    if (error instanceof Error) {
      console.log(`  Error: ${error.message}`);
    }
    failCount++;
  }
};

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

// ===== calculateFinancialSummary Tests =====

console.log('\n=== calculateFinancialSummary Tests ===\n');

test('Returns zero summary with empty fees and expenses', () => {
  const result = calculateFinancialSummary([], []);
  assert(result.totalIncome === 0, 'Total income should be 0');
  assert(result.totalExpenses === 0, 'Total expenses should be 0');
  assert(result.netBalance === 0, 'Net balance should be 0');
});

test('Calculates income from single paid fee correctly', () => {
  const fees = [createMockFee({ amount: 1000 })];
  const result = calculateFinancialSummary(fees, []);
  assert(result.totalIncome === 1000, `Expected 1000, got ${result.totalIncome}`);
  assert(result.totalExpenses === 0, 'Total expenses should be 0');
  assert(result.netBalance === 1000, `Expected 1000, got ${result.netBalance}`);
});

test('Sums multiple paid fees correctly', () => {
  const fees = [
    createMockFee({ amount: 1000 }),
    createMockFee({ amount: 1500, id: 'fee-2' }),
    createMockFee({ amount: 2000, id: 'fee-3' }),
  ];
  const result = calculateFinancialSummary(fees, []);
  const expectedIncome = 1000 + 1500 + 2000;
  assert(result.totalIncome === expectedIncome, `Expected ${expectedIncome}, got ${result.totalIncome}`);
  assert(result.netBalance === expectedIncome, `Expected ${expectedIncome}, got ${result.netBalance}`);
});

test('Only PAID fees are counted as income', () => {
  const fees = [
    createMockFee({ amount: 1000, status: FeeStatus.PAID }),
    createMockFee({ amount: 500, status: FeeStatus.PENDING, id: 'fee-2' }),
    createMockFee({ amount: 300, status: FeeStatus.OVERDUE, id: 'fee-3' }),
    createMockFee({ amount: 200, status: FeeStatus.WAIVED, id: 'fee-4' }),
  ];
  const result = calculateFinancialSummary(fees, []);
  assert(result.totalIncome === 1000, `Expected 1000, got ${result.totalIncome}`);
});

test('Calculates single expense correctly', () => {
  const expenses = [createMockExpense({ amount: 500 })];
  const result = calculateFinancialSummary([], expenses);
  assert(result.totalIncome === 0, 'Total income should be 0');
  assert(result.totalExpenses === 500, `Expected 500, got ${result.totalExpenses}`);
  assert(result.netBalance === -500, `Expected -500, got ${result.netBalance}`);
});

test('Sums multiple expenses correctly', () => {
  const expenses = [
    createMockExpense({ amount: 500 }),
    createMockExpense({ amount: 200, id: 'exp-2' }),
    createMockExpense({ amount: 300, id: 'exp-3' }),
  ];
  const result = calculateFinancialSummary([], expenses);
  const expectedExpenses = 500 + 200 + 300;
  assert(result.totalExpenses === expectedExpenses, `Expected ${expectedExpenses}, got ${result.totalExpenses}`);
  assert(result.netBalance === -expectedExpenses, `Expected ${-expectedExpenses}, got ${result.netBalance}`);
});

test('Calculates combined income and expenses correctly', () => {
  const fees = [
    createMockFee({ amount: 2000 }),
    createMockFee({ amount: 3000, id: 'fee-2' }),
  ];
  const expenses = [
    createMockExpense({ amount: 500 }),
    createMockExpense({ amount: 800, id: 'exp-2' }),
  ];
  const result = calculateFinancialSummary(fees, expenses);
  assert(result.totalIncome === 5000, `Expected 5000, got ${result.totalIncome}`);
  assert(result.totalExpenses === 1300, `Expected 1300, got ${result.totalExpenses}`);
  assert(result.netBalance === 3700, `Expected 3700, got ${result.netBalance}`);
});

test('Decimal amounts are rounded to 2 decimal places', () => {
  const fees = [
    createMockFee({ amount: 999.999 }),
    createMockFee({ amount: 1000.555, id: 'fee-2' }),
  ];
  const expenses = [
    createMockExpense({ amount: 500.333 }),
    createMockExpense({ amount: 250.777, id: 'exp-2' }),
  ];
  const result = calculateFinancialSummary(fees, expenses);
  // Sum: 999.999 + 1000.555 = 2000.554, rounded to 2000.55
  assert(result.totalIncome <= 2000.56, `Expected ~2000.55, got ${result.totalIncome}`);
  // Sum: 500.333 + 250.777 = 751.11
  assert(result.totalExpenses <= 751.12, `Expected ~751.11, got ${result.totalExpenses}`);
});

// ===== calculatePeriodBreakdowns Tests =====

console.log('\n=== calculatePeriodBreakdowns Tests ===\n');

test('Returns all 12 months + 4 quarters + 1 year with zero values', () => {
  const result = calculatePeriodBreakdowns([], []);
  const monthBreakdowns = result.filter((b) => b.period === 'MONTH');
  const quarterBreakdowns = result.filter((b) => b.period === 'QUARTER');
  const yearBreakdown = result.filter((b) => b.period === 'YEAR');

  assert(monthBreakdowns.length === 12, `Expected 12 months, got ${monthBreakdowns.length}`);
  assert(quarterBreakdowns.length === 4, `Expected 4 quarters, got ${quarterBreakdowns.length}`);
  assert(yearBreakdown.length === 1, `Expected 1 year, got ${yearBreakdown.length}`);

  monthBreakdowns.forEach((m, idx) => {
    assert(m.income === 0, `Month ${idx} income should be 0`);
    assert(m.expenses === 0, `Month ${idx} expenses should be 0`);
    assert(m.net === 0, `Month ${idx} net should be 0`);
  });
});

test('Categorizes January fees into January month and Q1', () => {
  const fees = [
    createMockFee({ amount: 1000, paidDate: new Date('2026-01-15') }),
    createMockFee({ amount: 500, paidDate: new Date('2026-01-20'), id: 'fee-2' }),
  ];
  const result = calculatePeriodBreakdowns(fees, []);

  const januaryMonth = result.find((b) => b.period === 'MONTH' && b.label.includes('January'));
  const q1Quarter = result.find((b) => b.period === 'QUARTER' && b.label === 'Q1 2026');
  const yearToDate = result.find((b) => b.period === 'YEAR');

  assert(januaryMonth?.income === 1500, `January income should be 1500, got ${januaryMonth?.income}`);
  assert(q1Quarter?.income === 1500, `Q1 income should be 1500, got ${q1Quarter?.income}`);
  assert(yearToDate?.income === 1500, `Year income should be 1500, got ${yearToDate?.income}`);
});

test('Excludes Q2 fees from Q1 breakdown', () => {
  const fees = [
    createMockFee({ amount: 1000, paidDate: new Date('2026-01-15') }), // Q1
    createMockFee({ amount: 500, paidDate: new Date('2026-04-15'), id: 'fee-2' }), // Q2
  ];
  const result = calculatePeriodBreakdowns(fees, []);

  const q1Quarter = result.find((b) => b.period === 'QUARTER' && b.label === 'Q1 2026');
  const q2Quarter = result.find((b) => b.period === 'QUARTER' && b.label === 'Q2 2026');

  assert(q1Quarter?.income === 1000, `Q1 income should be 1000, got ${q1Quarter?.income}`);
  assert(q2Quarter?.income === 500, `Q2 income should be 500, got ${q2Quarter?.income}`);
});

test('Distributes expenses across correct months and quarters', () => {
  const expenses = [
    createMockExpense({ amount: 200, date: new Date('2026-02-10') }), // Feb (Q1)
    createMockExpense({ amount: 300, date: new Date('2026-05-15'), id: 'exp-2' }), // May (Q2)
    createMockExpense({ amount: 400, date: new Date('2026-11-20'), id: 'exp-3' }), // Nov (Q4)
  ];
  const result = calculatePeriodBreakdowns([], expenses);

  const februaryMonth = result.find((b) => b.period === 'MONTH' && b.label.includes('February'));
  const mayMonth = result.find((b) => b.period === 'MONTH' && b.label.includes('May'));
  const q1Quarter = result.find((b) => b.period === 'QUARTER' && b.label === 'Q1 2026');
  const q2Quarter = result.find((b) => b.period === 'QUARTER' && b.label === 'Q2 2026');

  assert(februaryMonth?.expenses === 200, `Feb expenses should be 200`);
  assert(mayMonth?.expenses === 300, `May expenses should be 300`);
  assert(q1Quarter?.expenses === 200, `Q1 expenses should be 200`);
  assert(q2Quarter?.expenses === 300, `Q2 expenses should be 300`);
});

test('Calculates net balance for periods correctly', () => {
  const fees = [createMockFee({ amount: 5000, paidDate: new Date('2026-01-15') })];
  const expenses = [createMockExpense({ amount: 2000, date: new Date('2026-01-10') })];
  const result = calculatePeriodBreakdowns(fees, expenses);

  const januaryMonth = result.find((b) => b.period === 'MONTH' && b.label.includes('January'));
  assert(januaryMonth?.net === 3000, `Jan net should be 3000, got ${januaryMonth?.net}`);
});

test('Includes all transactions in year-to-date breakdown', () => {
  const fees = [
    createMockFee({ amount: 1000, paidDate: new Date('2026-01-15') }),
    createMockFee({ amount: 2000, paidDate: new Date('2026-06-15'), id: 'fee-2' }),
    createMockFee({ amount: 3000, paidDate: new Date('2026-12-15'), id: 'fee-3' }),
  ];
  const expenses = [
    createMockExpense({ amount: 500, date: new Date('2026-02-10') }),
    createMockExpense({ amount: 800, date: new Date('2026-07-20'), id: 'exp-2' }),
  ];
  const result = calculatePeriodBreakdowns(fees, expenses);

  const yearToDate = result.find((b) => b.period === 'YEAR');
  assert(yearToDate?.income === 6000, `Year income should be 6000, got ${yearToDate?.income}`);
  assert(yearToDate?.expenses === 1300, `Year expenses should be 1300, got ${yearToDate?.expenses}`);
  assert(yearToDate?.net === 4700, `Year net should be 4700, got ${yearToDate?.net}`);
});

test('Excludes transactions from previous years', () => {
  const fees = [
    createMockFee({ amount: 1000, paidDate: new Date('2026-01-15') }),
    createMockFee({ amount: 5000, paidDate: new Date('2025-12-15'), id: 'fee-2' }), // Previous year
  ];
  const expenses = [
    createMockExpense({ amount: 500, date: new Date('2026-02-10') }),
    createMockExpense({ amount: 2000, date: new Date('2025-11-20'), id: 'exp-2' }), // Previous year
  ];
  const result = calculatePeriodBreakdowns(fees, expenses);

  const yearToDate = result.find((b) => b.period === 'YEAR');
  assert(yearToDate?.income === 1000, `Year income should be 1000 (2026 only), got ${yearToDate?.income}`);
  assert(yearToDate?.expenses === 500, `Year expenses should be 500 (2026 only), got ${yearToDate?.expenses}`);
});

test('Excludes unpaid fees from period breakdowns', () => {
  const fees = [
    createMockFee({ amount: 1000, status: FeeStatus.PAID, paidDate: new Date('2026-01-15') }),
    createMockFee({ amount: 5000, status: FeeStatus.PENDING, paidDate: undefined, id: 'fee-2' }),
  ];
  const result = calculatePeriodBreakdowns(fees, []);

  const januaryMonth = result.find((b) => b.period === 'MONTH' && b.label.includes('January'));
  assert(januaryMonth?.income === 1000, `Jan income should be 1000 (paid only), got ${januaryMonth?.income}`);
});

// ===== getFinancialData Tests =====

console.log('\n=== getFinancialData Tests ===\n');

test('Returns complete financial data with summary and breakdowns', () => {
  const fees = [createMockFee({ amount: 2000 })];
  const expenses = [createMockExpense({ amount: 500 })];
  const result = getFinancialData(fees, expenses);

  assert(result.summary !== undefined, 'Summary should be defined');
  assert(result.breakdowns !== undefined, 'Breakdowns should be defined');
  assert(result.summary.totalIncome === 2000, 'Summary income should match');
  assert(result.summary.totalExpenses === 500, 'Summary expenses should match');
  assert(result.breakdowns.length === 17, `Should have 17 breakdowns (12+4+1), got ${result.breakdowns.length}`);
});

// ===== Test Summary =====

console.log('\n' + '='.repeat(50));
console.log(`Tests Passed: ${passCount}`);
console.log(`Tests Failed: ${failCount}`);
console.log(`Total Tests: ${passCount + failCount}`);
console.log('='.repeat(50));

if (failCount > 0) {
  process.exit(1);
}
