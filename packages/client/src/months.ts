// Month labels, January first, indexed by Date#getMonth().
export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const MONTH_ABBR = MONTH_NAMES.map((m) => m.slice(0, 3));
export const MONTH_INITIALS = MONTH_NAMES.map((m) => m[0]);
