/**
 * QFX/OFX Parser
 *
 * Parses QFX (Quicken Financial Exchange) and OFX (Open Financial Exchange) files.
 * QFX is essentially OFX + one Intuit-specific header field (INTUBID). Same parser handles both.
 *
 * QFX/OFX uses SGML, NOT XML. Key differences:
 *   - Some elements are self-closing (no </TAG>) e.g. <TRNTYPE>DEBIT
 *   - Only aggregate elements have closing tags (e.g. </STMTTRN>)
 *   - No attributes on elements
 *
 * Tested against real Wells Fargo QFX exports.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QfxTransaction {
  /** Transaction type: CREDIT, DEBIT, XFER, DIRECTDEBIT, etc. */
  type: string;
  /** Posted date (normalized to YYYY-MM-DD) */
  datePosted: string;
  /** Amount — already signed: negative = money out, positive = money in */
  amount: number;
  /** FITID — unique per account, our dedup key */
  fitId: string;
  /** Payee/description from NAME element */
  name: string;
  /** Additional memo text (may be empty) */
  memo: string;
  /** Check number if present */
  checkNum?: string;
  /** Reference number if present */
  refNum?: string;
}

export interface QfxAccountInfo {
  /** Bank routing number */
  bankId?: string;
  /** Account number */
  accountId?: string;
  /** Account type: CHECKING, SAVINGS, CREDITLINE, etc. */
  accountType?: string;
  /** Currency: USD, etc. */
  currency?: string;
  /** Statement date range */
  dateStart?: string;
  dateEnd?: string;
  /** Ledger balance */
  ledgerBalance?: number;
  ledgerBalanceDate?: string;
  /** Available balance */
  availableBalance?: number;
  availableBalanceDate?: string;
  /** Financial institution info */
  fiOrg?: string;
  fid?: string;
}

export interface QfxParseResult {
  account: QfxAccountInfo;
  transactions: QfxTransaction[];
  /** Raw header metadata */
  headerFields: Record<string, string>;
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

/**
 * Parse OFX date format into YYYY-MM-DD string.
 *
 * OFX date formats:
 *   - YYYYMMDD                              → "20260105"
 *   - YYYYMMDDHHMMSS.SSS (TZ:TZNAME)       → "20260105120000.000 (offset -8 PST)"
 *   - YYYYMMDDHHMMSS.SSS (TZ:TZNAME)        → "20260402110000.000 (offset -7 PDT)"
 */
export function parseOfxDate(raw: string): string {
  if (!raw || raw.length < 8) return "";

  const year = raw.substring(0, 4);
  const month = raw.substring(4, 6);
  const day = raw.substring(6, 8);

  return `${year}-${month}-${day}`;
}

// ─── SGML extraction helpers ──────────────────────────────────────────────────

/**
 * Extract a simple (non-aggregate) element value from SGML.
 * E.g. from "<TRNTYPE>DEBIT<DTPOSTED>20260105..."
 *   getElement(text, "TRNTYPE") → "DEBIT"
 *
 * Works for self-closing SGML elements where the value is everything
 * between <TAG> and the next < character.
 */
function getElement(sgml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^<]+)`, "i");
  const match = sgml.match(regex);
  return match ? match[1].trim() : "";
}

/**
 * Extract all blocks of an aggregate element.
 * E.g. getAllBlocks(text, "STMTTRN") → array of strings between <STMTTRN> and </STMTTRN>
 */
function getAllBlocks(sgml: string, tag: string): string[] {
  const blocks: string[] = [];
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;
  let pos = 0;

  while (pos < sgml.length) {
    const start = sgml.indexOf(openTag, pos);
    if (start === -1) break;

    const contentStart = start + openTag.length;
    const end = sgml.indexOf(closeTag, contentStart);
    if (end === -1) break;

    blocks.push(sgml.substring(contentStart, end));
    pos = end + closeTag.length;
  }

  return blocks;
}

/**
 * Extract a single aggregate block.
 */
function getBlock(sgml: string, tag: string): string {
  const blocks = getAllBlocks(sgml, tag);
  return blocks.length > 0 ? blocks[0] : "";
}

// ─── Header parsing ───────────────────────────────────────────────────────────

/**
 * Parse the OFX header (the part before <OFX>).
 * Format: KEY:VALUE pairs separated by newlines or concatenated.
 */
function parseHeader(headerStr: string): Record<string, string> {
  const fields: Record<string, string> = {};

  // Headers can be newline-separated or concatenated
  // Format: OFXHEADER:100DATA:OFXSGML...
  const pairs = headerStr.split(/(?=[A-Z]+:)/);

  for (const pair of pairs) {
    const colonIndex = pair.indexOf(":");
    if (colonIndex > 0) {
      const key = pair.substring(0, colonIndex).trim();
      const value = pair.substring(colonIndex + 1).trim();
      if (key) fields[key] = value;
    }
  }

  return fields;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse a QFX/OFX file content string into structured data.
 *
 * @param content - The raw file content as a string
 * @returns Parsed result with account info, transactions, and header fields
 */
export function parseQfx(content: string): QfxParseResult {
  // Split header and body at <OFX>
  const ofxIndex = content.indexOf("<OFX>");
  if (ofxIndex === -1) {
    throw new Error("Invalid QFX/OFX file: no <OFX> tag found");
  }

  const headerStr = content.substring(0, ofxIndex);
  const body = content.substring(ofxIndex);

  // Parse header
  const headerFields = parseHeader(headerStr);

  // ─── Account info ───────────────────────────────────────────────────

  const account: QfxAccountInfo = {};

  // Bank account info (BANKACCTFROM)
  const bankAcct = getBlock(body, "BANKACCTFROM");
  if (bankAcct) {
    account.bankId = getElement(bankAcct, "BANKID");
    account.accountId = getElement(bankAcct, "ACCTID");
    account.accountType = getElement(bankAcct, "ACCTTYPE");
  }

  // Credit card account info (CCACCTFROM) — for CC statements
  const ccAcct = getBlock(body, "CCACCTFROM");
  if (ccAcct) {
    account.accountId = getElement(ccAcct, "ACCTID");
    account.accountType = "CREDIT_CARD";
  }

  // Currency
  account.currency = getElement(body, "CURDEF") || "USD";

  // FI info
  const fiBlock = getBlock(body, "FI");
  if (fiBlock) {
    account.fiOrg = getElement(fiBlock, "ORG");
    account.fid = getElement(fiBlock, "FID");
  }

  // Date range from BANKTRANLIST
  const tranList = getBlock(body, "BANKTRANLIST");
  if (tranList) {
    const dtStart = getElement(tranList, "DTSTART");
    const dtEnd = getElement(tranList, "DTEND");
    if (dtStart) account.dateStart = parseOfxDate(dtStart);
    if (dtEnd) account.dateEnd = parseOfxDate(dtEnd);
  }

  // Ledger balance
  const ledgerBal = getBlock(body, "LEDGERBAL");
  if (ledgerBal) {
    const amt = getElement(ledgerBal, "BALAMT");
    if (amt) account.ledgerBalance = parseFloat(amt);
    const dt = getElement(ledgerBal, "DTASOF");
    if (dt) account.ledgerBalanceDate = parseOfxDate(dt);
  }

  // Available balance
  const availBal = getBlock(body, "AVAILBAL");
  if (availBal) {
    const amt = getElement(availBal, "BALAMT");
    if (amt) account.availableBalance = parseFloat(amt);
    const dt = getElement(availBal, "DTASOF");
    if (dt) account.availableBalanceDate = parseOfxDate(dt);
  }

  // ─── Transactions ──────────────────────────────────────────────────

  const transactionBlocks = getAllBlocks(body, "STMTTRN");
  const transactions: QfxTransaction[] = transactionBlocks.map((block) => {
    const rawAmount = getElement(block, "TRNAMT");
    const rawDate = getElement(block, "DTPOSTED");

    const tx: QfxTransaction = {
      type: getElement(block, "TRNTYPE"),
      datePosted: parseOfxDate(rawDate),
      amount: rawAmount ? parseFloat(rawAmount) : 0,
      fitId: getElement(block, "FITID"),
      name: getElement(block, "NAME"),
      memo: getElement(block, "MEMO"),
    };

    const checkNum = getElement(block, "CHECKNUM");
    if (checkNum) tx.checkNum = checkNum;

    const refNum = getElement(block, "REFNUM");
    if (refNum) tx.refNum = refNum;

    return tx;
  });

  return { account, transactions, headerFields };
}

// ─── Zelle detection ──────────────────────────────────────────────────────────

/**
 * Detect if a transaction is a Zelle transfer based on NAME and MEMO fields.
 * Returns true for both incoming and outgoing Zelle transfers.
 */
export function isZelleTransaction(tx: QfxTransaction): boolean {
  const combined = `${tx.name} ${tx.memo}`.toUpperCase();
  return (
    combined.includes("ZELLE") ||
    combined.includes("ZELLEPAY") ||
    combined.includes("ZELLE TO") ||
    combined.includes("ZELLE FROM")
  );
}

/**
 * Extract the Zelle counterparty name from a transaction.
 * E.g. "ZELLE TO HAID IVAN ON 01/03 REF" → "HAID IVAN"
 *      "ZELLE FROM DARRYL VAS" → "DARRYL VAS" (memo may contain rest: "PRABHU ON ...")
 */
export function extractZelleCounterparty(tx: QfxTransaction): string | null {
  const combined = `${tx.name} ${tx.memo}`.toUpperCase();

  // Pattern: ZELLE TO <NAME> ON MM/DD
  const toMatch = combined.match(
    /ZELLE\s+TO\s+(.+?)\s+ON\s+\d{2}\/\d{2}/
  );
  if (toMatch) return toMatch[1].trim();

  // Pattern: ZELLE FROM <NAME> ON MM/DD (name may span NAME and MEMO fields)
  const fromMatch = combined.match(
    /ZELLE\s+FROM\s+(.+?)\s+ON\s+\d{2}\/\d{2}/
  );
  if (fromMatch) return fromMatch[1].trim();

  // Fallback: just grab everything after ZELLE TO/FROM
  const fallbackTo = combined.match(/ZELLE\s+TO\s+(.+?)(?:\s+ON\s+|$)/);
  if (fallbackTo) return fallbackTo[1].trim();

  const fallbackFrom = combined.match(
    /ZELLE\s+FROM\s+(.+?)(?:\s+ON\s+|$)/
  );
  if (fallbackFrom) return fallbackFrom[1].trim();

  return null;
}

// ─── Merchant normalization (rule-based) ──────────────────────────────────────

const MERCHANT_RULES: Array<{
  pattern: RegExp;
  replacement: string;
}> = [
  // Common merchants — add more as patterns emerge
  { pattern: /COSTCO\s*(WHOLESALE)?.*$/i, replacement: "Costco" },
  { pattern: /WAL-?MART.*$/i, replacement: "Walmart" },
  { pattern: /TARGET\s*T?-?\d*.*$/i, replacement: "Target" },
  { pattern: /STARBUCKS.*$/i, replacement: "Starbucks" },
  { pattern: /AMAZON\.COM.*$/i, replacement: "Amazon" },
  { pattern: /AMZN\s*MKTP.*$/i, replacement: "Amazon" },
  { pattern: /TRADER\s*JOE.*$/i, replacement: "Trader Joe's" },
  { pattern: /WHOLE\s*FOODS.*$/i, replacement: "Whole Foods" },
  { pattern: /CHEVRON.*$/i, replacement: "Chevron" },
  { pattern: /SHELL\s*(OIL|SERVICE)?.*$/i, replacement: "Shell" },
  { pattern: /UBER\s*(EATS)?.*$/i, replacement: "Uber" },
  { pattern: /LYFT.*$/i, replacement: "Lyft" },
  { pattern: /DOORDASH.*$/i, replacement: "DoorDash" },
  { pattern: /GRUBHUB.*$/i, replacement: "Grubhub" },
  { pattern: /NETFLIX.*$/i, replacement: "Netflix" },
  { pattern: /SPOTIFY.*$/i, replacement: "Spotify" },
  { pattern: /APPLE\.COM.*$/i, replacement: "Apple" },
  { pattern: /GOOGLE\s*\*.*$/i, replacement: "Google" },
  { pattern: /PAYPAL.*$/i, replacement: "PayPal" },
  { pattern: /VENMO.*$/i, replacement: "Venmo" },
];

/**
 * Attempt to normalize a raw merchant name using rule-based patterns.
 * Returns the normalized name, or the original cleaned name if no rule matches.
 */
export function normalizeMerchant(rawName: string): string {
  if (!rawName) return "";

  for (const rule of MERCHANT_RULES) {
    if (rule.pattern.test(rawName)) {
      return rule.replacement;
    }
  }

  // Generic cleanup: strip trailing location, numbers, and excess whitespace
  let cleaned = rawName;

  // Remove trailing state abbreviations and zip codes
  cleaned = cleaned.replace(
    /\s+[A-Z]{2}\s+\d{5}(-\d{4})?\s*$/,
    ""
  );
  // Remove trailing city names after # patterns (e.g. "#123 DALY CITY CA")
  cleaned = cleaned.replace(/\s*#\d+\s*.*$/, "");
  // Trim and collapse whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Title case
  cleaned = cleaned
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

  return cleaned;
}
