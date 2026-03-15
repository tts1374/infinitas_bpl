import type { WorkerEnv } from "../types/env";
import { parseJsonBody } from "../utils/http";
import { isRecord } from "../utils/validation";

const FEEDBACK_CATEGORIES = ["bug", "feature", "other"] as const;
const MAX_TITLE_LENGTH = 100;
const MAX_SUMMARY_LENGTH = 2000;
const MAX_STEPS_LENGTH = 2000;
const MAX_SUPPLEMENT_LENGTH = 2000;
const MAX_PROBLEM_LENGTH = 2000;
const MAX_PROPOSAL_LENGTH = 2000;
const MAX_CONTENT_LENGTH = 3000;
const MAX_FEEDBACKS_PER_MINUTE = 3;
const RATE_LIMIT_WINDOW_SECONDS = 70;
const DEDUPE_WINDOW_SECONDS = 60;
const DISCORD_CONTENT_LIMIT = 1900;
const FIELD_BLOCK_PATTERNS: RegExp[] = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\bjoin\s*code\b/i,
  /合言葉/i,
  /\bdisplay\s*name\b/i,
  /表示名/i,
  /[A-Za-z]:\\[^\s]+/,
  /\/(?:Users|home|var|tmp)\/[^\s]+/,
];

type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

interface FeedbackClientMeta {
  appVersion: string;
  platform: string;
  screen: string;
  sentAt: string;
}

interface FeedbackBugBody {
  summary: string;
  steps: string;
  supplement: string;
}

interface FeedbackFeatureBody {
  problem: string;
  proposal: string;
}

interface FeedbackOtherBody {
  content: string;
}

type FeedbackBody = FeedbackBugBody | FeedbackFeatureBody | FeedbackOtherBody;

interface FeedbackPayloadBase {
  title: string;
  client: FeedbackClientMeta;
}

interface FeedbackBugPayload extends FeedbackPayloadBase {
  category: "bug";
  body: FeedbackBugBody;
}

interface FeedbackFeaturePayload extends FeedbackPayloadBase {
  category: "feature";
  body: FeedbackFeatureBody;
}

interface FeedbackOtherPayload extends FeedbackPayloadBase {
  category: "other";
  body: FeedbackOtherBody;
}

type FeedbackPayload = FeedbackBugPayload | FeedbackFeaturePayload | FeedbackOtherPayload;

interface FeedbackSuccessResponse {
  ok: true;
  result: {
    category: FeedbackCategory;
    destination: "github" | "kv";
    key?: string;
    dry_run?: boolean;
  };
}

interface FeedbackDestinationResult {
  destination: "github" | "kv";
  key?: string;
  issueNumber?: number;
  issueUrl?: string;
}

interface FeedbackErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

class FeedbackApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "FeedbackApiError";
  }
}

function feedbackErrorResponse(error: FeedbackApiError): Response {
  const payload: FeedbackErrorResponse = {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
    },
  };

  return new Response(JSON.stringify(payload), {
    status: error.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function feedbackSuccessResponse(payload: FeedbackSuccessResponse["result"]): Response {
  const body: FeedbackSuccessResponse = {
    ok: true,
    result: payload,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function toFeedbackApiError(error: unknown): FeedbackApiError {
  if (error instanceof FeedbackApiError) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Unknown error.";
  return new FeedbackApiError(500, "INTERNAL_ERROR", message);
}

function ensureRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new FeedbackApiError(400, "VALIDATION_ERROR", `${fieldName} must be an object`);
  }

  return value;
}

function sanitizeText(raw: string): string {
  let sanitized = "";
  for (const char of raw) {
    const code = char.charCodeAt(0);
    const isBlockedControl =
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f;
    sanitized += isBlockedControl ? " " : char;
  }

  return sanitized.trim();
}

function countTextLength(value: string): number {
  return Array.from(value).length;
}

function readTextField(
  source: Record<string, unknown>,
  key: string,
  options: { required: boolean; maxLength: number },
): string {
  const raw = source[key];
  if (typeof raw !== "string") {
    if (options.required) {
      throw new FeedbackApiError(400, "VALIDATION_ERROR", `${key} is required`);
    }
    return "";
  }

  const value = sanitizeText(raw);
  if (options.required && value.length === 0) {
    throw new FeedbackApiError(400, "VALIDATION_ERROR", `${key} is required`);
  }

  if (countTextLength(value) > options.maxLength) {
    throw new FeedbackApiError(400, "VALIDATION_ERROR", `${key} is too long`);
  }

  return value;
}

function readCategory(input: Record<string, unknown>): FeedbackCategory {
  const value = input.category;
  if (typeof value !== "string") {
    throw new FeedbackApiError(400, "VALIDATION_ERROR", "category is required");
  }

  if (!FEEDBACK_CATEGORIES.includes(value as FeedbackCategory)) {
    throw new FeedbackApiError(400, "VALIDATION_ERROR", "category is invalid");
  }

  return value as FeedbackCategory;
}

function parseClientMeta(input: Record<string, unknown>): FeedbackClientMeta {
  const clientRecord = ensureRecord(input.client, "client");
  const appVersion = readTextField(clientRecord, "appVersion", { required: true, maxLength: 64 });
  const platform = readTextField(clientRecord, "platform", { required: true, maxLength: 64 });
  const screen = readTextField(clientRecord, "screen", { required: true, maxLength: 64 });
  const sentAt = readTextField(clientRecord, "sentAt", { required: true, maxLength: 64 });

  if (Number.isNaN(Date.parse(sentAt))) {
    throw new FeedbackApiError(400, "VALIDATION_ERROR", "sentAt must be an ISO8601 timestamp");
  }

  return {
    appVersion,
    platform,
    screen,
    sentAt,
  };
}

function parseBody(category: "bug", rawBody: Record<string, unknown>): FeedbackBugBody;
function parseBody(category: "feature", rawBody: Record<string, unknown>): FeedbackFeatureBody;
function parseBody(category: "other", rawBody: Record<string, unknown>): FeedbackOtherBody;
function parseBody(category: FeedbackCategory, rawBody: Record<string, unknown>): FeedbackBody {
  if (category === "bug") {
    return {
      summary: readTextField(rawBody, "summary", { required: true, maxLength: MAX_SUMMARY_LENGTH }),
      steps: readTextField(rawBody, "steps", { required: false, maxLength: MAX_STEPS_LENGTH }),
      supplement: readTextField(rawBody, "supplement", { required: false, maxLength: MAX_SUPPLEMENT_LENGTH }),
    };
  }

  if (category === "feature") {
    return {
      problem: readTextField(rawBody, "problem", { required: true, maxLength: MAX_PROBLEM_LENGTH }),
      proposal: readTextField(rawBody, "proposal", { required: true, maxLength: MAX_PROPOSAL_LENGTH }),
    };
  }

  return {
    content: readTextField(rawBody, "content", { required: true, maxLength: MAX_CONTENT_LENGTH }),
  };
}

function collectTextFields(payload: FeedbackPayload): string[] {
  const textFields: string[] = [
    payload.title,
    payload.client.appVersion,
    payload.client.platform,
    payload.client.screen,
  ];

  if (payload.category === "bug") {
    textFields.push(payload.body.summary, payload.body.steps, payload.body.supplement);
  } else if (payload.category === "feature") {
    textFields.push(payload.body.problem, payload.body.proposal);
  } else {
    textFields.push(payload.body.content);
  }

  return textFields;
}

function enforceSensitiveTextGuard(payload: FeedbackPayload): void {
  const joined = collectTextFields(payload).join("\n");
  for (const pattern of FIELD_BLOCK_PATTERNS) {
    if (pattern.test(joined)) {
      throw new FeedbackApiError(
        400,
        "VALIDATION_ERROR",
        "入力内容に公開不適切な情報が含まれている可能性があります",
      );
    }
  }
}

async function parseFeedbackRequest(request: Request): Promise<FeedbackPayload> {
  let body: unknown;
  try {
    body = await parseJsonBody(request);
  } catch (error) {
    throw new FeedbackApiError(400, "VALIDATION_ERROR", error instanceof Error ? error.message : "Invalid request body");
  }

  const input = ensureRecord(body, "request");
  const category = readCategory(input);
  const title = readTextField(input, "title", { required: true, maxLength: MAX_TITLE_LENGTH });
  const rawBody = ensureRecord(input.body, "body");
  const client = parseClientMeta(input);
  let payload: FeedbackPayload;
  if (category === "bug") {
    payload = {
      category,
      title,
      body: parseBody("bug", rawBody),
      client,
    };
  } else if (category === "feature") {
    payload = {
      category,
      title,
      body: parseBody("feature", rawBody),
      client,
    };
  } else {
    payload = {
      category,
      title,
      body: parseBody("other", rawBody),
      client,
    };
  }

  enforceSensitiveTextGuard(payload);
  return payload;
}

function parseCounter(value: string | null): number {
  if (value === null) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function hexFromBytes(input: Uint8Array): string {
  return Array.from(input)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return hexFromBytes(bytes).slice(0, length);
}

async function hashFeedbackPayload(payload: FeedbackPayload): Promise<string> {
  const text = JSON.stringify({
    category: payload.category,
    title: payload.title,
    body: payload.body,
  });
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return hexFromBytes(new Uint8Array(hashBuffer)).slice(0, 16);
}

function trimConfig(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isProductionEnv(env: WorkerEnv): boolean {
  return trimConfig(env.APP_ENV).toLowerCase() === "production";
}

async function enforceRateLimit(request: Request, env: WorkerEnv, payloadHash: string): Promise<void> {
  const ipAddress = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const rateKey = `feedback_rate:${ipAddress}:${minuteBucket}`;
  const dedupeKey = `feedback_dedupe:${ipAddress}:${payloadHash}`;

  const currentCount = parseCounter(await env.FEEDBACK_KV.get(rateKey, "text"));
  if (currentCount >= MAX_FEEDBACKS_PER_MINUTE) {
    throw new FeedbackApiError(429, "RATE_LIMITED", "送信間隔を空けてください");
  }

  const duplicated = await env.FEEDBACK_KV.get(dedupeKey, "text");
  if (duplicated !== null) {
    throw new FeedbackApiError(429, "RATE_LIMITED", "同じ内容の連続送信はできません");
  }

  await env.FEEDBACK_KV.put(rateKey, String(currentCount + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
  await env.FEEDBACK_KV.put(dedupeKey, "1", { expirationTtl: DEDUPE_WINDOW_SECONDS });
}

function buildGitHubIssueTitle(payload: FeedbackPayload): string {
  if (payload.category === "bug") {
    return `[Bug] ${payload.title}`;
  }
  return `[Feature] ${payload.title}`;
}

function buildBugIssueBody(payload: FeedbackPayload, appEnv: string): string {
  if (payload.category !== "bug") {
    throw new Error("bug payload required");
  }

  const steps = payload.body.steps.length > 0 ? payload.body.steps : "Not provided";
  const supplement = payload.body.supplement.length > 0 ? payload.body.supplement : "Not provided";
  return [
    "## Category",
    "Bug",
    "",
    "## What Happened",
    payload.body.summary,
    "",
    "## What Were You Doing Before It Happened",
    steps,
    "",
    "## Additional Notes",
    supplement,
    "",
    "## Environment",
    `- app_version: ${payload.client.appVersion}`,
    `- platform: ${payload.client.platform}`,
    `- screen: ${payload.client.screen}`,
    `- sent_at: ${payload.client.sentAt}`,
    `- app_env: ${appEnv}`,
  ].join("\n");
}

function buildFeatureIssueBody(payload: FeedbackPayload, appEnv: string): string {
  if (payload.category !== "feature") {
    throw new Error("feature payload required");
  }

  return [
    "## Category",
    "Feature Request",
    "",
    "## Problem",
    payload.body.problem,
    "",
    "## Proposal",
    payload.body.proposal,
    "",
    "## Environment",
    `- app_version: ${payload.client.appVersion}`,
    `- platform: ${payload.client.platform}`,
    `- screen: ${payload.client.screen}`,
    `- sent_at: ${payload.client.sentAt}`,
    `- app_env: ${appEnv}`,
  ].join("\n");
}

async function createGitHubIssue(payload: FeedbackPayload, env: WorkerEnv): Promise<FeedbackDestinationResult> {
  const owner = trimConfig(env.REPO_OWNER_GITHUB);
  const repo = trimConfig(env.REPO_NAME_GITHUB);
  const token = trimConfig(env.ISSUE_TOKEN);
  if (owner.length === 0 || repo.length === 0 || token.length === 0) {
    throw new FeedbackApiError(500, "CONFIG_ERROR", "GitHub issue destination is not configured");
  }
  if (payload.category !== "bug" && payload.category !== "feature") {
    throw new FeedbackApiError(500, "INTERNAL_ERROR", "Invalid issue category");
  }

  const issueBody = payload.category === "bug"
    ? buildBugIssueBody(payload, trimConfig(env.APP_ENV))
    : buildFeatureIssueBody(payload, trimConfig(env.APP_ENV));
  const labels = payload.category === "bug" ? ["from-app", "bug"] : ["from-app", "enhancement"];
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
      "user-agent": "infinitas-feedback-worker",
    },
    body: JSON.stringify({
      title: buildGitHubIssueTitle(payload),
      body: issueBody,
      labels,
    }),
  });

  if (!response.ok) {
    throw new FeedbackApiError(502, "DESTINATION_ERROR", "GitHub Issue の作成に失敗しました");
  }

  const responseBody = (await response.json()) as {
    number?: number;
    html_url?: string;
  };
  if (typeof responseBody.number !== "number" || typeof responseBody.html_url !== "string") {
    throw new FeedbackApiError(502, "DESTINATION_ERROR", "GitHub Issue のレスポンスが不正です");
  }

  return {
    destination: "github",
    issueNumber: responseBody.number,
    issueUrl: responseBody.html_url,
  };
}

async function saveToKv(payload: FeedbackPayload, env: WorkerEnv): Promise<FeedbackDestinationResult> {
  if (payload.category !== "other") {
    throw new FeedbackApiError(500, "INTERNAL_ERROR", "Invalid KV category");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const key = `feedback:${timestamp}:${randomHex(6)}`;
  const value = {
    id: key,
    category: payload.category,
    title: payload.title,
    body: payload.body,
    client: payload.client,
    appEnv: trimConfig(env.APP_ENV),
    status: "new",
  };

  try {
    await env.FEEDBACK_KV.put(key, JSON.stringify(value));
  } catch {
    throw new FeedbackApiError(502, "DESTINATION_ERROR", "フィードバック保存に失敗しました");
  }

  return {
    destination: "kv",
    key,
  };
}

async function saveFeedback(payload: FeedbackPayload, env: WorkerEnv): Promise<FeedbackDestinationResult> {
  if (payload.category === "bug" || payload.category === "feature") {
    return createGitHubIssue(payload, env);
  }

  return saveToKv(payload, env);
}

function clipText(input: string, maxLength: number): string {
  return Array.from(input).slice(0, maxLength).join("");
}

function buildDiscordContent(payload: FeedbackPayload, env: WorkerEnv, destination: FeedbackDestinationResult): string {
  const appEnv = trimConfig(env.APP_ENV) || "unknown";
  const header = `[${payload.category.toUpperCase()}][${appEnv}] ${payload.title}`;
  const details = [
    `appVersion: ${payload.client.appVersion}`,
    `platform: ${payload.client.platform}`,
    `screen: ${payload.client.screen}`,
    `sentAt: ${payload.client.sentAt}`,
  ];

  if (payload.category === "bug") {
    details.push(`issue: ${destination.issueNumber ? `#${destination.issueNumber}` : destination.issueUrl ?? "-"}`);
    details.push(`summary: ${clipText(payload.body.summary, 200)}`);
  } else if (payload.category === "feature") {
    details.push(`issue: ${destination.issueNumber ? `#${destination.issueNumber}` : destination.issueUrl ?? "-"}`);
    details.push(`problem: ${clipText(payload.body.problem, 200)}`);
  } else {
    details.push(`kv: ${destination.key ?? "-"}`);
    details.push(`content: ${clipText(payload.body.content, 200)}`);
  }

  return clipText([header, ...details].join("\n"), DISCORD_CONTENT_LIMIT);
}

async function notifyDiscord(payload: FeedbackPayload, env: WorkerEnv, destination: FeedbackDestinationResult): Promise<void> {
  const webhookUrl = trimConfig(env.DISCORD_WEBHOOK_URL);
  if (webhookUrl.length === 0) {
    return;
  }

  const content = buildDiscordContent(payload, env, destination);
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        content,
        allowed_mentions: { parse: [] },
      }),
    });
    if (!response.ok) {
      console.warn(`feedback discord notify failed: status=${response.status}`);
    }
  } catch (error) {
    console.warn(`feedback discord notify failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function handlePostFeedback(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    const payload = await parseFeedbackRequest(request);
    const payloadHash = await hashFeedbackPayload(payload);
    await enforceRateLimit(request, env, payloadHash);

    if (!isProductionEnv(env)) {
      const intendedDestination: "github" | "kv" = payload.category === "other" ? "kv" : "github";
      console.info(
        JSON.stringify({
          event: "feedback_dry_run",
          app_env: trimConfig(env.APP_ENV) || "unknown",
          category: payload.category,
          destination: intendedDestination,
          title: payload.title,
          client: payload.client,
          received_at: new Date().toISOString(),
        }),
      );

      return feedbackSuccessResponse({
        category: payload.category,
        destination: intendedDestination,
        dry_run: true,
      });
    }

    const destination = await saveFeedback(payload, env);
    await notifyDiscord(payload, env, destination);

    return feedbackSuccessResponse({
      category: payload.category,
      destination: destination.destination,
      ...(destination.key ? { key: destination.key } : {}),
    });
  } catch (error) {
    return feedbackErrorResponse(toFeedbackApiError(error));
  }
}
