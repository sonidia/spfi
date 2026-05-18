export const SHEET_TABS = {
  QUAN_LY: "quản lý",
  FBS: "FBS",
  BUFF1: "order 1",
  BUFF2: "Sheet1",
} as const;

export const SPF_SHEET_TABS = ["Shopify T3/2026", "Shopify T4/2026"] as const;

export const BUFF_SHEET_NAMES = {
  BUFF1: "$ buff1",
  BUFF2: "$ buff2",
};

export const SHEET_RANGES = {
  QUAN_LY_ALL: `'${SHEET_TABS.QUAN_LY}'!A:Z`,
  FBS_ALL: `'${SHEET_TABS.FBS}'!A:Z`,
  BUFF1_ALL: `'${SHEET_TABS.BUFF1}'!A:Z`,
  BUFF2_ALL: `'${SHEET_TABS.BUFF2}'!A:Z`,
} as const;

export const SHEET_COLUMNS = {
  QUAN_LY: {
    date: 0,
    shopName: 1,
    domain: 2,
    buff1Amount: 4,
    buff2Amount: 5,
    totalAmount: 6,
    bank: 7,
    status: 9,
  },
  FBS: {
    domain: 2,
    shopName: 3,
    colE: 4,
    bank: 19,
  },
  BUFF: {
    domain: 3,
    customer: 7,
    status: 1,
    tracking: 10,
    payoutDate: 11,
  },
} as const;
