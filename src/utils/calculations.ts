/**
 * Calculate age from date of birth
 */
export const calculateAge = (dateOfBirth: Date): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

/**
 * Calculate BMI from height (cm) and weight (kg)
 */
export const calculateBMI = (heightCm: number, weightKg: number): number => {
  const heightM = heightCm / 100;
  return parseFloat((weightKg / (heightM * heightM)).toFixed(1));
};

/**
 * Generate current bi-monthly cycle key (e.g., "Jan-Feb 2026")
 */
export const getCurrentCycleKey = (): string => {
  const month = new Date().getMonth(); // 0-11
  const year = new Date().getFullYear();

  const cycles = [
    'Jan-Feb',
    'Jan-Feb',
    'Mar-Apr',
    'Mar-Apr',
    'May-Jun',
    'May-Jun',
    'Jul-Aug',
    'Jul-Aug',
    'Sep-Oct',
    'Sep-Oct',
    'Nov-Dec',
    'Nov-Dec',
  ];

  return `${cycles[month]} ${year}`;
};

/**
 * Check if a date is in the past
 */
export const isPastDate = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate < today;
};
