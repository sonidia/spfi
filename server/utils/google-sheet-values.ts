// RAW prevents user-controlled strings beginning with =, +, -, or @ from
// being interpreted as formulas by Google Sheets.
export const GOOGLE_SHEET_VALUE_INPUT_OPTION = "RAW" as const;
