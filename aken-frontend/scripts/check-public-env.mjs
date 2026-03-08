import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const PUBLIC_PREFIX = "NEXT_PUBLIC_";
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src");

const ENV_FILES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
  ".env.preview",
  ".env.preview.local",
  ".env.test",
  ".env.test.local",
];

const ALLOWED_PUBLIC_VARS = new Set([
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_GA_ID",
  "NEXT_PUBLIC_GOOGLE_ADS_ID",
  "NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL",
  "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
]);

const FORBIDDEN_PUBLIC_KEYWORDS = [
  "SECRET",
  "PASSWORD",
  "TOKEN",
  "PRIVATE",
  "API_KEY",
  "ACCESS_KEY",
  "AUTH",
  "JWT",
  "MONGO",
  "DATABASE",
  "SMTP",
  "WEBHOOK",
  "STRIPE",
  "RAZORPAY",
];

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".git",
  ".vercel",
]);

const violations = [];

function getLineNumber(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function isForbiddenPublicVariable(variableName) {
  const normalized = variableName.toUpperCase();
  if (!normalized.startsWith(PUBLIC_PREFIX)) {
    return false;
  }

  if (ALLOWED_PUBLIC_VARS.has(normalized)) {
    return false;
  }

  return FORBIDDEN_PUBLIC_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function registerViolation(filePath, lineNumber, message) {
  violations.push({
    filePath: path.relative(PROJECT_ROOT, filePath),
    lineNumber,
    message,
  });
}

function checkEnvironmentFiles() {
  const envKeyPattern = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;

  for (const fileName of ENV_FILES) {
    const filePath = path.join(PROJECT_ROOT, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      const match = trimmed.match(envKeyPattern);
      if (!match) {
        return;
      }

      const key = (match[1] || "").trim().toUpperCase();
      if (isForbiddenPublicVariable(key)) {
        registerViolation(
          filePath,
          index + 1,
          `Remove "${key}" from public env. Secrets must never use the NEXT_PUBLIC_ prefix.`,
        );
      }
    });
  }
}

function walkDirectory(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (SKIP_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const resolvedPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDirectory(resolvedPath));
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(resolvedPath);
    }
  }

  return files;
}

function checkSourceFiles() {
  if (!fs.existsSync(SOURCE_ROOT)) {
    return;
  }

  const sourceFiles = walkDirectory(SOURCE_ROOT);
  const envPattern = /process\.env\.([A-Z0-9_]+)/g;

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const prologue = content.split(/\r?\n/).slice(0, 12).join("\n");
    const isClientFile = /^\s*["']use client["'];?/m.test(prologue);

    for (const match of content.matchAll(envPattern)) {
      const full = match[0];
      const variableName = match[1];
      const matchIndex = match.index || 0;
      const lineNumber = getLineNumber(content, matchIndex);
      const normalized = variableName.toUpperCase();

      if (isForbiddenPublicVariable(normalized)) {
        registerViolation(
          filePath,
          lineNumber,
          `Unsafe public variable "${full}" detected. Use a server-only env key without NEXT_PUBLIC_.`,
        );
      }

      if (isClientFile && !normalized.startsWith(PUBLIC_PREFIX) && normalized !== "NODE_ENV") {
        registerViolation(
          filePath,
          lineNumber,
          `Client file references server env "${full}". Move this logic to a server route or remove the secret access.`,
        );
      }
    }
  }
}

function printResultAndExit() {
  if (!violations.length) {
    console.log("[security:env-check] Passed. No public secret exposure detected.");
    process.exit(0);
  }

  console.error("[security:env-check] Failed. Secret exposure risks found:\n");
  for (const violation of violations) {
    console.error(`- ${violation.filePath}:${violation.lineNumber} ${violation.message}`);
  }

  process.exit(1);
}

checkEnvironmentFiles();
checkSourceFiles();
printResultAndExit();
