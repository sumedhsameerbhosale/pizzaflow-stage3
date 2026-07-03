/**
 * Direct TypeScript port of Stage 2's validators.py -- same regex
 * semantics and same error-message text, so this is provably the exact
 * same validation behavior, not a re-implementation that could drift.
 *
 * Used both client-side (instant field feedback) and re-run server-side
 * in the /api/orders route handler as the authoritative gate.
 */

const NAME_RE = /^[A-Za-z ]{2,40}$/;
const DIGITS_RE = /^\d+$/;
const INT_RE = /^-?\d+$/;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function validateName(raw: string): ValidationResult<string> {
  const candidate = raw.trim();
  if (!candidate) {
    return {
      ok: false,
      error:
        "Name cannot be empty or just spaces. Please enter your name (letters and spaces only).",
    };
  }
  if (!NAME_RE.test(candidate)) {
    return {
      ok: false,
      error:
        "Invalid name: only alphabets and spaces are allowed, length 2-40 characters. Please try again.",
    };
  }
  return { ok: true, value: candidate };
}

export function validatePhone(raw: string): ValidationResult<string> {
  const candidate = raw.trim();
  if (!candidate) {
    return {
      ok: false,
      error: "Phone number cannot be empty. Please enter a 10-digit number.",
    };
  }
  if (!DIGITS_RE.test(candidate)) {
    return {
      ok: false,
      error:
        "Invalid phone number: must contain digits only (no spaces, dashes, or letters).",
    };
  }
  if (candidate.length !== 10) {
    return {
      ok: false,
      error: `Invalid phone number: must be exactly 10 digits, you entered ${candidate.length}.`,
    };
  }
  if (!"6789".includes(candidate[0])) {
    return {
      ok: false,
      error: "Invalid phone number: must start with 6, 7, 8, or 9.",
    };
  }
  return { ok: true, value: candidate };
}

export function validateQuantity(raw: string): ValidationResult<number> {
  const candidate = raw.trim();
  if (!candidate) {
    return {
      ok: false,
      error: "Quantity cannot be empty. Please enter a whole number from 1 to 10.",
    };
  }
  if (!INT_RE.test(candidate)) {
    return {
      ok: false,
      error: `Invalid quantity: "${candidate}" is not a whole number. Please enter digits only (e.g. 3).`,
    };
  }
  const value = parseInt(candidate, 10);
  if (value <= 0) {
    return {
      ok: false,
      error: `Invalid quantity: ${value} is not allowed. Quantity must be between 1 and 10.`,
    };
  }
  if (value > 10) {
    return {
      ok: false,
      error: `Invalid quantity: ${value} exceeds the maximum. Quantity must be between 1 and 10.`,
    };
  }
  return { ok: true, value };
}

export function validatePaymentMode(
  raw: string
): ValidationResult<"Cash" | "Card" | "UPI"> {
  if (raw === "Cash" || raw === "Card" || raw === "UPI") {
    return { ok: true, value: raw };
  }
  return {
    ok: false,
    error: "Invalid selection: please choose Cash, Card, or UPI.",
  };
}

/**
 * For the admin-editable discount quantity threshold (see
 * app_settings). Range is 1-10 because quantity itself is capped at
 * 10 -- a threshold above that could never trigger.
 */
export function validateDiscountThreshold(raw: string): ValidationResult<number> {
  const candidate = raw.trim();
  if (!candidate) {
    return { ok: false, error: "Threshold cannot be empty. Please enter a whole number from 1 to 10." };
  }
  if (!INT_RE.test(candidate)) {
    return {
      ok: false,
      error: `Invalid threshold: "${candidate}" is not a whole number. Please enter digits only (e.g. 3).`,
    };
  }
  const value = parseInt(candidate, 10);
  if (value < 1 || value > 10) {
    return {
      ok: false,
      error: `Invalid threshold: ${value} is out of range. Please enter a whole number from 1 to 10.`,
    };
  }
  return { ok: true, value };
}

/**
 * Stage 2's `validate_menu_choice` ("enter item number 1-N") doesn't
 * port 1:1 -- the web UI binds selections to real menu_items.id values
 * via <select>/buttons, so there's no numeric index to range-check on
 * the client. The equivalent check (does this id exist, is it active,
 * is it the right category) happens server-side in /api/orders against
 * freshly-fetched menu rows -- see route.ts.
 */
