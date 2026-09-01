/**
 * NFC UID Converter & Matcher Utility
 * Supports bidirectional conversion between:
 * 1. Hexadecimal format (e.g., "08:08:A1:B2" or "0808A1B2")
 * 2. Decimal Big-Endian (Standard MSB-first, e.g., "134783410" / "0134783410")
 * 3. Decimal Little-Endian (Reverse Byte LSB-first as output by most USB Desktop NFC Readers, e.g., "2996963336")
 */

export interface NfcConversionResult {
  rawInput: string;
  isHexInput: boolean;
  isDecimalInput: boolean;
  hexClean: string;           // e.g. "0808A1B2"
  hexColon: string;           // e.g. "08:08:A1:B2"
  hexReverse: string;         // e.g. "B2A10808"
  hexReverseColon: string;    // e.g. "B2:A1:08:08"
  decimalStandard: string;    // Big-Endian: e.g. "134783410"
  decimalStandard10: string;  // 10-digit padded: e.g. "0134783410"
  decimalReverse: string;     // Little-Endian (USB Reader): e.g. "2996963336"
  decimalReverse10: string;   // 10-digit padded: e.g. "2996963336"
  allEquivalentVariants: string[]; // List of all valid search keys
}

/**
 * Strips formatting (colons, spaces, dashes) from a string
 */
export function cleanCodeString(str: string): string {
  if (!str) return "";
  return str.replace(/[:\s\-_]/g, "").trim().toUpperCase();
}

/**
 * Splits a clean hex string into 2-character byte chunks
 */
export function hexToByteChunks(hex: string): string[] {
  const clean = cleanCodeString(hex);
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    chunks.push(clean.substring(i, i + 2));
  }
  return chunks;
}

/**
 * Converts byte chunks to standard colon-separated format (e.g. ["08", "08", "A1", "B2"] -> "08:08:A1:B2")
 */
export function formatHexColon(hex: string): string {
  const chunks = hexToByteChunks(hex);
  return chunks.join(":");
}

/**
 * Reverses byte order (e.g. "0808A1B2" -> "B2A10808")
 */
export function reverseHexBytes(hex: string): string {
  const chunks = hexToByteChunks(hex);
  return chunks.reverse().join("");
}

/**
 * Checks whether a string is valid Hex (contains 0-9, A-F and even length when stripped)
 */
export function isValidHex(str: string): boolean {
  const clean = cleanCodeString(str);
  if (!clean || clean.length % 2 !== 0) return false;
  return /^[0-9A-F]+$/i.test(clean);
}

/**
 * Checks whether a string is purely digits
 */
export function isPureDigits(str: string): boolean {
  const clean = str.trim();
  return clean.length > 0 && /^\d+$/.test(clean);
}

/**
 * Converts Hex string to BigInt decimal safely
 */
function hexToBigInt(hex: string): bigint {
  const clean = cleanCodeString(hex);
  if (!clean) return BigInt(0);
  return BigInt("0x" + clean);
}

/**
 * Converts BigInt to hex padded to given byte count
 */
function bigIntToHex(num: bigint, byteLength: number = 4): string {
  let hex = num.toString(16).toUpperCase();
  const targetLength = byteLength * 2;
  if (hex.length < targetLength) {
    hex = hex.padStart(targetLength, "0");
  }
  return hex;
}

/**
 * Generates comprehensive conversion details from any input (Hex or Decimal)
 */
export function convertNfcUid(input: string): NfcConversionResult {
  const raw = (input || "").trim();
  const clean = cleanCodeString(raw);
  
  let hexClean = "";
  let isHex = false;
  let isDec = false;

  if (isValidHex(raw) && !isPureDigits(raw)) {
    // Definitive Hex (contains letters A-F or colons)
    isHex = true;
    hexClean = clean;
  } else if (isPureDigits(raw)) {
    isDec = true;
    try {
      const decNum = BigInt(raw);
      // Determine byte length (typically 4 bytes for Mifare Classic 32-bit, or up to 7 bytes)
      let byteLen = 4;
      if (decNum > BigInt("0xFFFFFFFF")) {
        byteLen = 7;
      }
      hexClean = bigIntToHex(decNum, byteLen);
    } catch {
      hexClean = clean.padStart(8, "0");
    }
  } else if (isValidHex(raw)) {
    isHex = true;
    hexClean = clean;
  } else {
    hexClean = clean;
  }

  // Ensure even length for hex
  if (hexClean.length % 2 !== 0) {
    hexClean = "0" + hexClean;
  }

  const hexReverse = reverseHexBytes(hexClean);
  const hexColon = formatHexColon(hexClean);
  const hexReverseColon = formatHexColon(hexReverse);

  let decimalStandard = "";
  let decimalReverse = "";

  try {
    const stdBigInt = hexToBigInt(hexClean);
    decimalStandard = stdBigInt.toString(10);
  } catch {
    decimalStandard = "";
  }

  try {
    const revBigInt = hexToBigInt(hexReverse);
    decimalReverse = revBigInt.toString(10);
  } catch {
    decimalReverse = "";
  }

  const decimalStandard10 = decimalStandard ? decimalStandard.padStart(10, "0") : "";
  const decimalReverse10 = decimalReverse ? decimalReverse.padStart(10, "0") : "";

  // Build a set of all unique equivalent representations for fast O(1) matching
  const variantsSet = new Set<string>();
  
  if (raw) variantsSet.add(raw.toUpperCase());
  if (clean) variantsSet.add(clean.toUpperCase());
  if (hexClean) variantsSet.add(hexClean.toUpperCase());
  if (hexColon) variantsSet.add(hexColon.toUpperCase());
  if (hexReverse) variantsSet.add(hexReverse.toUpperCase());
  if (hexReverseColon) variantsSet.add(hexReverseColon.toUpperCase());
  
  if (decimalStandard) variantsSet.add(decimalStandard);
  if (decimalStandard10) variantsSet.add(decimalStandard10);
  if (decimalReverse) variantsSet.add(decimalReverse);
  if (decimalReverse10) variantsSet.add(decimalReverse10);

  // If input was decimal digits, also add the parsed BigInt equivalents
  if (isPureDigits(raw)) {
    try {
      const parsedNum = BigInt(raw);
      // Case A: treat input as Big-Endian Decimal -> find its Little-Endian Hex & Dec
      const hexFromStd = bigIntToHex(parsedNum, 4);
      const revHexFromStd = reverseHexBytes(hexFromStd);
      const revDecFromStd = hexToBigInt(revHexFromStd).toString(10);
      variantsSet.add(hexFromStd);
      variantsSet.add(formatHexColon(hexFromStd));
      variantsSet.add(revHexFromStd);
      variantsSet.add(formatHexColon(revHexFromStd));
      variantsSet.add(revDecFromStd);
      variantsSet.add(revDecFromStd.padStart(10, "0"));

      // Case B: treat input as Little-Endian Decimal (USB Reader output) -> find its Big-Endian Hex & Dec
      const hexFromRev = bigIntToHex(parsedNum, 4);
      const stdHexFromRev = reverseHexBytes(hexFromRev);
      const stdDecFromRev = hexToBigInt(stdHexFromRev).toString(10);
      variantsSet.add(hexFromRev);
      variantsSet.add(formatHexColon(hexFromRev));
      variantsSet.add(stdHexFromRev);
      variantsSet.add(formatHexColon(stdHexFromRev));
      variantsSet.add(stdDecFromRev);
      variantsSet.add(stdDecFromRev.padStart(10, "0"));
    } catch {
      // ignore bigInt parse error
    }
  }

  const allEquivalentVariants = Array.from(variantsSet).filter(Boolean);

  return {
    rawInput: raw,
    isHexInput: isHex,
    isDecimalInput: isDec,
    hexClean,
    hexColon,
    hexReverse,
    hexReverseColon,
    decimalStandard,
    decimalStandard10,
    decimalReverse,
    decimalReverse10,
    allEquivalentVariants
  };
}

/**
 * Checks if two NFC IDs match across ANY representation (Hex, Dec Standard, Dec Reverse, Colon, 10-digit)
 */
export function isNfcMatch(scannedCode: string, studentCardId: string): boolean {
  if (!scannedCode || !studentCardId) return false;

  const cleanScan = cleanCodeString(scannedCode);
  const cleanStudent = cleanCodeString(studentCardId);

  // 1. Direct match after basic clean
  if (cleanScan === cleanStudent) return true;

  // 2. Direct string match
  if (scannedCode.trim().toUpperCase() === studentCardId.trim().toUpperCase()) return true;

  // 3. Bidirectional variant matching
  const scanDetails = convertNfcUid(scannedCode);
  const studentDetails = convertNfcUid(studentCardId);

  // Check if scan's variants contain student card's raw or clean code
  if (
    scanDetails.allEquivalentVariants.includes(studentCardId.trim().toUpperCase()) ||
    scanDetails.allEquivalentVariants.includes(cleanStudent)
  ) {
    return true;
  }

  // Check if student's variants contain scanned code
  if (
    studentDetails.allEquivalentVariants.includes(scannedCode.trim().toUpperCase()) ||
    studentDetails.allEquivalentVariants.includes(cleanScan)
  ) {
    return true;
  }

  // Check intersection of equivalent sets
  const scanSet = new Set(scanDetails.allEquivalentVariants);
  for (const variant of studentDetails.allEquivalentVariants) {
    if (scanSet.has(variant)) return true;
  }

  return false;
}
