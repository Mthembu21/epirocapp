// Overtime pay rules: overtime hours are paid at 1.5x Monday to Saturday and 2x on
// Sundays and public holidays; normal hours at 1x. Worked out from the entry itself
// (date + public-holiday flag) rather than trusting the stored overtime_multiplier,
// which older entries saved as 1x for weekday overtime.

// log_date is stored as midnight UTC of the booked day, so read the UTC weekday.
const isSunday = (logDate) => {
    const d = new Date(logDate);
    return !Number.isNaN(d.getTime()) && d.getUTCDay() === 0;
};

export const overtimeRateFor = (entry) =>
    (entry?.is_public_holiday || isSunday(entry?.log_date)) ? 2 : 1.5;

// Rate to show for an entry: the overtime rate when it has overtime, otherwise 1x.
export const appliedRateFor = (entry) =>
    Number(entry?.overtime_hours || 0) > 0 ? overtimeRateFor(entry) : 1;

// Payable hours = normal + overtime x rate. Falls back to the stored figure when the
// entry has no normal/overtime split yet (e.g. a declined entry counts as 0).
export const payableHoursFor = (entry) => {
    const normal = Number(entry?.normal_hours || 0);
    const overtime = Number(entry?.overtime_hours || 0);
    if (normal + overtime > 0) return normal + overtime * overtimeRateFor(entry);
    return Number(entry?.payable_hours || 0);
};
