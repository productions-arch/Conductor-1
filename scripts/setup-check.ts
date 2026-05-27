/**
 * setup-check.ts — verifies environment variables before deploy.
 *
 * Run with: npm run setup-check
 *
 * Exits non-zero if any required variable is missing or malformed.
 */
import "dotenv/config";

type Check = {
  key: string;
  required: boolean;
  validate?: (v: string) => string | null; // returns error or null
  hint?: string;
};

const checks: Check[] = [
  {
    key: "DATABASE_URL",
    required: true,
    validate: (v) =>
      v.startsWith("postgresql://") || v.startsWith("postgres://")
        ? null
        : "must start with postgresql:// or postgres://",
    hint: "Get from Neon → Connection details (use the pooled URL).",
  },
  {
    key: "ENCRYPTION_KEY",
    required: true,
    validate: (v) => {
      try {
        const b = Buffer.from(v, "base64");
        return b.length === 32 ? null : `decoded to ${b.length} bytes, need exactly 32`;
      } catch {
        return "not valid base64";
      }
    },
    hint: "Generate with: openssl rand -base64 32",
  },
  {
    key: "AUTH_SECRET",
    required: true,
    validate: (v) => (v.length >= 32 ? null : "should be at least 32 chars"),
    hint: "Generate with: openssl rand -base64 32",
  },
  {
    key: "GOOGLE_CLIENT_ID",
    required: true,
    validate: (v) =>
      v.endsWith(".apps.googleusercontent.com")
        ? null
        : 'should end with ".apps.googleusercontent.com"',
  },
  { key: "GOOGLE_CLIENT_SECRET", required: true },
  { key: "PUBLIC_BASE_URL", required: false, hint: "e.g. https://conductor.vercel.app" },
  { key: "APPLE_CLIENT_ID", required: false, hint: "Leave blank to hide Apple button" },
  { key: "APPLE_TEAM_ID", required: false },
  { key: "APPLE_KEY_ID", required: false },
  { key: "APPLE_PRIVATE_KEY", required: false },
];

let failed = 0;
let warnings = 0;

console.log("Conductor — setup check\n");

for (const c of checks) {
  const v = process.env[c.key];
  if (!v) {
    if (c.required) {
      console.log(`  ✗ ${c.key} — missing (required)`);
      if (c.hint) console.log(`       ${c.hint}`);
      failed++;
    } else {
      console.log(`  · ${c.key} — not set (optional)`);
      warnings++;
    }
    continue;
  }
  if (c.validate) {
    const err = c.validate(v);
    if (err) {
      console.log(`  ✗ ${c.key} — ${err}`);
      if (c.hint) console.log(`       ${c.hint}`);
      failed++;
      continue;
    }
  }
  console.log(`  ✓ ${c.key}`);
}

// Apple group consistency check
const appleVars = ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"];
const appleSet = appleVars.filter((k) => process.env[k]);
if (appleSet.length > 0 && appleSet.length < appleVars.length) {
  console.log(
    `\n  ! Apple sign-in is partially configured (${appleSet.length}/4 vars set).`,
  );
  console.log("     Set all four, or leave all four blank to disable.");
  warnings++;
}

console.log("");
if (failed > 0) {
  console.log(`Failed: ${failed} required check(s).`);
  process.exit(1);
}
console.log(`OK. ${warnings > 0 ? `${warnings} optional warning(s).` : "All required vars present."}`);
