import { createHash, createHmac } from "node:crypto";

import type { ApiConfig } from "./config.ts";
import type { ApiRepository, PostRecord } from "./repository.ts";

export interface ReceiptVerificationJobPayload {
  postId: string;
  userId: string;
  receiptKey: string;
  receiptStorageRef: string | null;
}

export interface ReceiptOcrService {
  extractReceiptText: (input: { receiptKey: string; receiptStorageRef: string }) => Promise<string>;
}

export interface ReceiptVerificationDecision {
  status: "verified" | "failed";
  matchedTerms: string[];
  purchaseDate: string | null;
  rawText: string;
}

const ninetyDaysInMilliseconds = 90 * 24 * 60 * 60 * 1000;
const googleVisionEndpoint = "https://vision.googleapis.com/v1/images:annotate";
const receiptStopWords = new Set([
  "a",
  "an",
  "and",
  "buy",
  "community",
  "dupe",
  "filter",
  "for",
  "from",
  "glow",
  "item",
  "items",
  "liquid",
  "order",
  "price",
  "receipt",
  "review",
  "save",
  "swap",
  "the",
  "this",
  "with"
]);
const monthByName = new Map<string, number>([
  ["jan", 0],
  ["january", 0],
  ["feb", 1],
  ["february", 1],
  ["mar", 2],
  ["march", 2],
  ["apr", 3],
  ["april", 3],
  ["may", 4],
  ["jun", 5],
  ["june", 5],
  ["jul", 6],
  ["july", 6],
  ["aug", 7],
  ["august", 7],
  ["sep", 8],
  ["sept", 8],
  ["september", 8],
  ["oct", 9],
  ["october", 9],
  ["nov", 10],
  ["november", 10],
  ["dec", 11],
  ["december", 11]
]);

const formatAmzDate = (value: Date) => value.toISOString().replace(/[-:]|\.\d{3}/g, "");

const sha256Hex = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const hmac = (key: Buffer | string, value: string) => createHmac("sha256", key).update(value, "utf8").digest();

const encodeR2PathSegment = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

const buildCanonicalObjectPath = (bucket: string, key: string) =>
  `/${encodeR2PathSegment(bucket)}/${key.split("/").map(encodeR2PathSegment).join("/")}`;

const parseReceiptStorageReference = (storageRef: string) => {
  const match = /^r2:\/\/([^/]+)\/(.+)$/.exec(storageRef);

  if (!match) {
    throw new Error("Receipt storage reference must use the r2://bucket/key format.");
  }

  return {
    bucket: match[1],
    key: match[2]
  };
};

const signR2GetRequest = (config: ApiConfig, bucket: string, key: string, now: Date) => {
  const shortDate = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate = formatAmzDate(now);
  const host = `${config.cloudflareR2AccountId}.r2.cloudflarestorage.com`;
  const canonicalUri = buildCanonicalObjectPath(bucket, key);
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = ["GET", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${shortDate}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.cloudflareR2SecretKey}`, shortDate), "auto"), "s3"),
    "aws4_request"
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  const authorization = [
    "AWS4-HMAC-SHA256",
    `Credential=${config.cloudflareR2AccessKey}/${credentialScope},`,
    `SignedHeaders=${signedHeaders},`,
    `Signature=${signature}`
  ].join(" ");

  return {
    authorization,
    host,
    canonicalUri,
    amzDate,
    payloadHash
  };
};

const fetchReceiptObject = async (config: ApiConfig, receiptStorageRef: string) => {
  const { bucket, key } = parseReceiptStorageReference(receiptStorageRef);
  const now = new Date();
  const request = signR2GetRequest(config, bucket, key, now);
  const response = await fetch(`https://${request.host}${request.canonicalUri}`, {
    headers: {
      Authorization: request.authorization,
      "x-amz-content-sha256": request.payloadHash,
      "x-amz-date": request.amzDate
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to read receipt object from R2 (${response.status}).`);
  }

  return Buffer.from(await response.arrayBuffer()).toString("base64");
};

const normalizeReceiptText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const uniqueSearchTerms = (post: PostRecord) => {
  const terms = [
    post.originalProductName,
    post.originalBrand,
    post.dupeProductName,
    post.dupeBrand
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => normalizeReceiptText(value).split(" "))
    .filter((term) => term.length >= 4 && !receiptStopWords.has(term));

  return Array.from(new Set(terms));
};

const createUtcDate = (year: number, month: number, day: number) => {
  const value = new Date(Date.UTC(year, month, day));

  if (
    Number.isNaN(value.getTime()) ||
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month ||
    value.getUTCDate() !== day
  ) {
    return null;
  }

  return value;
};

const normalizeParsedYear = (year: number) => (year < 100 ? 2000 + year : year);

const extractReceiptDates = (rawText: string) => {
  const dates = new Map<number, Date>();

  for (const match of rawText.matchAll(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g)) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const value = createUtcDate(year, month, day);

    if (value) {
      dates.set(value.getTime(), value);
    }
  }

  for (const match of rawText.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g)) {
    const month = Number(match[1]) - 1;
    const day = Number(match[2]);
    const year = normalizeParsedYear(Number(match[3]));
    const value = createUtcDate(year, month, day);

    if (value) {
      dates.set(value.getTime(), value);
    }
  }

  for (const match of rawText.matchAll(/\b([A-Za-z]{3,9})\s+(\d{1,2})(?:,)?\s+(\d{2,4})\b/g)) {
    const month = monthByName.get(match[1].toLowerCase());

    if (month === undefined) {
      continue;
    }

    const day = Number(match[2]);
    const year = normalizeParsedYear(Number(match[3]));
    const value = createUtcDate(year, month, day);

    if (value) {
      dates.set(value.getTime(), value);
    }
  }

  return Array.from(dates.values()).sort((left, right) => right.getTime() - left.getTime());
};

const isReceiptDateWithinWindow = (value: Date, now: Date) => {
  const delta = now.getTime() - value.getTime();
  return delta >= 0 && delta <= ninetyDaysInMilliseconds;
};

const readReceiptJobPayload = (payload: Record<string, unknown>): ReceiptVerificationJobPayload => {
  const postId = typeof payload.postId === "string" ? payload.postId : "";
  const userId = typeof payload.userId === "string" ? payload.userId : "";
  const receiptKey = typeof payload.receiptKey === "string" ? payload.receiptKey : "";
  const receiptStorageRef = typeof payload.receiptStorageRef === "string" ? payload.receiptStorageRef : null;

  if (!postId || !userId || !receiptKey) {
    throw new Error("verify-receipt jobs require postId, userId, and receiptKey.");
  }

  return {
    postId,
    userId,
    receiptKey,
    receiptStorageRef
  };
};

export const evaluateReceiptText = (rawText: string, post: PostRecord, now: Date = new Date()): ReceiptVerificationDecision => {
  const normalizedText = normalizeReceiptText(rawText);
  const matchedTerms = uniqueSearchTerms(post).filter((term) => normalizedText.includes(term));
  const purchaseDate =
    extractReceiptDates(rawText).find((candidate) => isReceiptDateWithinWindow(candidate, now))?.toISOString() ?? null;
  const status = matchedTerms.length > 0 && purchaseDate ? "verified" : "failed";

  return {
    status,
    matchedTerms,
    purchaseDate,
    rawText
  };
};

export const createGoogleVisionReceiptOcrService = (config: ApiConfig): ReceiptOcrService => ({
  extractReceiptText: async ({ receiptStorageRef }) => {
    const imageContent = await fetchReceiptObject(config, receiptStorageRef);
    const response = await fetch(`${googleVisionEndpoint}?key=${encodeURIComponent(config.ocrServiceKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: imageContent
            },
            features: [
              {
                type: "TEXT_DETECTION",
                maxResults: 1
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Receipt OCR request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as {
      responses?: Array<{
        fullTextAnnotation?: { text?: string };
        textAnnotations?: Array<{ description?: string }>;
        error?: { message?: string };
      }>;
    };
    const firstResponse = payload.responses?.[0];

    if (firstResponse?.error?.message) {
      throw new Error(firstResponse.error.message);
    }

    return firstResponse?.fullTextAnnotation?.text ?? firstResponse?.textAnnotations?.[0]?.description ?? "";
  }
});

export const createReceiptVerificationJobHandler = (options: {
  config: ApiConfig;
  repository: ApiRepository;
  ocrService?: ReceiptOcrService;
  now?: () => Date;
}) => {
  const ocrService = options.ocrService ?? createGoogleVisionReceiptOcrService(options.config);

  return async (payload: Record<string, unknown>) => {
    const job = readReceiptJobPayload(payload);
    const post = await options.repository.findPostById(job.postId, {
      includeInactive: true
    });

    if (
      !post ||
      post.user.id !== job.userId ||
      !post.receiptUrl ||
      post.receiptVerificationStatus !== "pending" ||
      (job.receiptStorageRef && post.receiptUrl !== job.receiptStorageRef)
    ) {
      return;
    }

    const rawText = await ocrService.extractReceiptText({
      receiptKey: job.receiptKey,
      receiptStorageRef: post.receiptUrl
    });
    const decision = evaluateReceiptText(rawText, post, options.now?.() ?? new Date());

    await options.repository.resolveReceiptVerification(post.id, decision.status);
  };
};
