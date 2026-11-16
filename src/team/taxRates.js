// Tax numbers for the paycheck estimate, for 2026.
// CHECK AND UPDATE THESE EVERY JANUARY:
//   Federal   IRS Publication 15-T (brackets, standard deduction) and the Social
//             Security wage base (ssa.gov)
//   New York  NYS-50-T-NYS (withholding), NYS-50-T-NYC (city), and the paid
//             family leave rate (paidfamilyleave.ny.gov)
// Money is dollars a year unless it says otherwise.

export const TAX_YEAR = 2026

// Federal income tax: [top of bracket, rate]. The last bracket has no top.
const FED_SINGLE = [[12400, 0.1], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [Infinity, 0.37]]
const FED_MARRIED = [[24800, 0.1], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [Infinity, 0.37]]
const FED_HEAD = [[17700, 0.1], [67450, 0.12], [105700, 0.22], [201750, 0.24], [256200, 0.32], [640600, 0.35], [Infinity, 0.37]]

export const FEDERAL = {
  brackets: { single: FED_SINGLE, married: FED_MARRIED, head: FED_HEAD },
  standardDeduction: { single: 16100, married: 32200, head: 24150 },
}

export const SOCIAL_SECURITY = { rate: 0.062, wageBase: 184500 }
export const MEDICARE = { rate: 0.0145, extraRate: 0.009, extraOver: 200000 }

// New York State income tax (2026 rates). HoH files as single on the IT-2104.
const NY_SINGLE = [[8500, 0.039], [11700, 0.044], [13900, 0.0515], [80650, 0.054], [215400, 0.059], [1077550, 0.0685], [5000000, 0.0965], [25000000, 0.103], [Infinity, 0.109]]
const NY_MARRIED = [[17150, 0.039], [23600, 0.044], [27900, 0.0515], [161550, 0.054], [323200, 0.059], [2155350, 0.0685], [5000000, 0.0965], [25000000, 0.103], [Infinity, 0.109]]

export const NEW_YORK = {
  brackets: { single: NY_SINGLE, married: NY_MARRIED },
  // Taken off the year's wages before the tax table, like NYS-50-T's exact calculation.
  deductionAllowance: { single: 7400, married: 7950 },
  perAllowance: 1000,
}

// New York City resident tax (only for employees who live in the five boroughs).
export const NYC = {
  brackets: {
    single: [[12000, 0.03078], [25000, 0.03762], [50000, 0.03819], [Infinity, 0.03876]],
    married: [[21600, 0.03078], [45000, 0.03762], [90000, 0.03819], [Infinity, 0.03876]],
  },
}

// New York disability (DBL): 0.5% of wages, at most 60 cents a week.
export const NY_DISABILITY = { rate: 0.005, maxPerWeek: 0.6 }
// New York paid family leave: a share of wages, up to a yearly maximum.
export const NY_PAID_FAMILY_LEAVE = { rate: 0.00432, maxPerYear: 411.91 }

// Lowest legal hourly pay in the New York areas in 2026, so the
// Team tab can warn about a rate typed by mistake.
export const NY_MIN_WAGE = 17
// Overtime: time and a half after this many hours in the pay week.
export const OVERTIME_AFTER_HOURS = 40
export const OVERTIME_RATE = 1.5
