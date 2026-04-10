const EMAIL_SPLIT_REGEX = /[,\s]+/;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function collectConfiguredEmails(): Set<string> {
  const configured = [
    process.env.OWNER_EMAIL || "",
    process.env.ALLOWED_EMAILS || "",
  ]
    .flatMap((value) => value.split(EMAIL_SPLIT_REGEX))
    .map(normalizeEmail)
    .filter(Boolean);

  return new Set(configured);
}

export function getAllowedEmails(): Set<string> {
  return collectConfiguredEmails();
}

export function isAllowlistConfigured(): boolean {
  return getAllowedEmails().size > 0;
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowedEmails = getAllowedEmails();
  if (allowedEmails.size === 0) return false;
  return allowedEmails.has(normalizeEmail(email));
}
