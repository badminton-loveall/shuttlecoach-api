/**
 * Session slot overlap validator.
 * Pure function that checks whether any two session slots overlap on the same day.
 *
 * Two slots overlap if their time ranges intersect:
 *   slot A [startA, startA + durationA) and slot B [startB, startB + durationB)
 * overlap when startA < endB AND startB < endA.
 */

export interface SessionSlot {
  day_of_week: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  start_time: string; // "HH:MM" 24-hour format
  duration_hours: number; // 1–4
}

/**
 * Converts a "HH:MM" time string to total minutes from midnight.
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Validates that no two session slots overlap on the same day.
 * Returns a result indicating validity and any conflicting slot index pairs.
 *
 * @param slots - Array of session slots to validate
 * @returns Object with `valid` boolean and `conflicts` array of [indexA, indexB] pairs
 */
export function validateNoOverlap(slots: SessionSlot[]): {
  valid: boolean;
  conflicts: [number, number][];
} {
  const conflicts: [number, number][] = [];

  // Group slot indices by day_of_week
  const dayGroups: Map<string, number[]> = new Map();
  for (let i = 0; i < slots.length; i++) {
    const day = slots[i].day_of_week;
    if (!dayGroups.has(day)) {
      dayGroups.set(day, []);
    }
    dayGroups.get(day)!.push(i);
  }

  // For each day, check all pairs for overlap
  for (const indices of dayGroups.values()) {
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const idxA = indices[a];
        const idxB = indices[b];

        const startA = timeToMinutes(slots[idxA].start_time);
        const endA = startA + slots[idxA].duration_hours * 60;

        const startB = timeToMinutes(slots[idxB].start_time);
        const endB = startB + slots[idxB].duration_hours * 60;

        // Overlap condition: startA < endB AND startB < endA
        if (startA < endB && startB < endA) {
          conflicts.push([idxA, idxB]);
        }
      }
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts,
  };
}
