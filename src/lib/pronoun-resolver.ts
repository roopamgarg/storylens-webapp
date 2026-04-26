import winkNLP, { type WinkMethods } from "wink-nlp";
import model from "wink-eng-lite-web-model";

export type ResolverResult = {
  resolvedStory: string;
  stats: {
    pronounsFound: number;
    pronounsResolved: number;
    pronounsSkipped: number;
  };
  applied: Array<{
    pronoun: string;
    position: { sentenceIndex: number; tokenIndex: number };
    replacement: string;
    confidence: "high";
  }>;
  skipReason?: "input_too_long" | "model_failure";
};

type ResolvePronounsOptions = {
  maxChars?: number;
};

type GenderHint = "masc" | "fem" | "neutral" | "unknown";
type PronounClass = "masc" | "fem" | "neutral";
type PronounRole = "subject" | "object";

type TokenData = {
  text: string;
  lower: string;
  pos: string;
  precedingSpaces: string;
  sentenceIndex: number;
  tokenIndex: number;
};

type PersonMention = {
  text: string;
  normalized: string;
  sentenceIndex: number;
  tokenIndex: number;
};

type TrackedPronoun = {
  className: PronounClass;
  role: PronounRole;
  pronoun: string;
};

const DEFAULT_MAX_CHARS = 10_000;
const LOOKBACK_SENTENCE_COUNT = 3;

let nlpInstance: WinkMethods | null = null;
let initPromise: Promise<WinkMethods> | null = null;

function getEmptyResult(story: string, skipReason?: ResolverResult["skipReason"]): ResolverResult {
  return {
    resolvedStory: story,
    stats: {
      pronounsFound: 0,
      pronounsResolved: 0,
      pronounsSkipped: 0,
    },
    applied: [],
    skipReason,
  };
}

function normalizeName(value: string): string {
  return value.toLocaleLowerCase();
}

function mergeHint(existing: GenderHint | undefined, next: GenderHint): GenderHint {
  if (!existing) {
    return next;
  }
  if (existing === next) {
    return existing;
  }
  return "unknown";
}

function getHintForPronoun(lower: string): GenderHint | null {
  if (lower === "he" || lower === "him" || lower === "his") {
    return "masc";
  }
  if (lower === "she" || lower === "her" || lower === "hers") {
    return "fem";
  }
  if (lower === "they" || lower === "them" || lower === "their") {
    return "neutral";
  }
  return null;
}

function isPossessiveHer(tokens: TokenData[], index: number): boolean {
  const token = tokens[index];
  if (token.lower !== "her") {
    return false;
  }

  const next = tokens[index + 1];
  if (!next) {
    return false;
  }

  return next.pos === "NOUN" || next.pos === "PROPN" || next.pos === "ADJ";
}

function getTrackedPronoun(tokens: TokenData[], index: number): TrackedPronoun | null {
  const token = tokens[index];
  if (token.lower === "he" || token.lower === "him") {
    return {
      className: "masc",
      role: token.lower === "he" ? "subject" : "object",
      pronoun: token.text,
    };
  }
  if (token.lower === "she") {
    return { className: "fem", role: "subject", pronoun: token.text };
  }
  if (token.lower === "her") {
    if (isPossessiveHer(tokens, index)) {
      return null;
    }
    return { className: "fem", role: "object", pronoun: token.text };
  }
  if (token.lower === "they" || token.lower === "them") {
    return {
      className: "neutral",
      role: token.lower === "they" ? "subject" : "object",
      pronoun: token.text,
    };
  }

  return null;
}

function filterObjectPronounCandidates(
  distinct: Map<string, PersonMention[]>,
  pronounSentenceIndex: number,
  pronounTokenIndex: number,
): Map<string, PersonMention[]> {
  const filtered = new Map<string, PersonMention[]>();

  distinct.forEach((mentions, normalizedName) => {
    const hasSameSentenceMentionBeforePronoun = mentions.some(
      (mention) =>
        mention.sentenceIndex === pronounSentenceIndex && mention.tokenIndex < pronounTokenIndex,
    );

    if (!hasSameSentenceMentionBeforePronoun) {
      filtered.set(normalizedName, mentions);
    }
  });

  return filtered;
}

function buildTokenMatrix(nlp: WinkMethods, story: string): TokenData[][] {
  const doc = nlp.readDoc(story);
  const matrix: TokenData[][] = [];

  doc.sentences().each((sentence, sentenceIndex) => {
    const tokens: TokenData[] = [];
    sentence.tokens().each((token, tokenIndex) => {
      const text = token.out();
      tokens.push({
        text,
        lower: text.toLocaleLowerCase(),
        pos: String(token.out(nlp.its.pos)),
        precedingSpaces: String(token.out(nlp.its.precedingSpaces)),
        sentenceIndex,
        tokenIndex,
      });
    });
    matrix.push(tokens);
  });

  return matrix;
}

function buildPersonMentions(tokenMatrix: TokenData[][]): PersonMention[] {
  const mentions: PersonMention[] = [];

  tokenMatrix.forEach((tokens, sentenceIndex) => {
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      const isCandidateStart = token.pos === "PROPN" && /^\p{Lu}/u.test(token.text);
      if (!isCandidateStart) {
        i += 1;
        continue;
      }

      const chunks: string[] = [token.text];
      const startIndex = token.tokenIndex;
      i += 1;
      while (i < tokens.length && tokens[i].pos === "PROPN") {
        chunks.push(tokens[i].text);
        i += 1;
      }

      const text = chunks.join(" ");
      mentions.push({
        text,
        normalized: normalizeName(text),
        sentenceIndex,
        tokenIndex: startIndex,
      });
    }
  });

  return mentions;
}

function collectGlobalHints(tokenMatrix: TokenData[][], personMentions: PersonMention[]): Map<string, GenderHint> {
  const hints = new Map<string, GenderHint>();

  tokenMatrix.forEach((tokens, sentenceIndex) => {
    tokens.forEach((token, tokenIndex) => {
      const hint = getHintForPronoun(token.lower);
      if (!hint) {
        return;
      }

      const eligibleMentions = personMentions.filter(
        (mention) => mention.sentenceIndex === sentenceIndex && mention.tokenIndex < tokenIndex,
      );

      const distinctByName = new Map<string, PersonMention>();
      eligibleMentions.forEach((mention) => {
        if (!distinctByName.has(mention.normalized)) {
          distinctByName.set(mention.normalized, mention);
        }
      });

      if (distinctByName.size !== 1) {
        return;
      }

      const [name] = Array.from(distinctByName.keys());
      hints.set(name, mergeHint(hints.get(name), hint));
    });
  });

  return hints;
}

function getWindowMentions(
  personMentions: PersonMention[],
  sentenceIndex: number,
  tokenIndex: number,
): PersonMention[] {
  const minSentence = sentenceIndex - LOOKBACK_SENTENCE_COUNT;

  return personMentions.filter((mention) => {
    if (mention.sentenceIndex < minSentence || mention.sentenceIndex > sentenceIndex) {
      return false;
    }

    if (mention.sentenceIndex === sentenceIndex) {
      return mention.tokenIndex < tokenIndex;
    }

    return true;
  });
}

function canResolvePronoun(pronounClass: PronounClass, hint: GenderHint): boolean {
  if (pronounClass === "neutral") {
    return hint === "neutral" || hint === "unknown";
  }

  if (pronounClass === "masc") {
    if (hint === "fem") {
      return false;
    }
    return hint === "masc" || hint === "unknown";
  }

  if (hint === "masc") {
    return false;
  }
  return hint === "fem" || hint === "unknown";
}

function buildResolvedStory(tokenMatrix: TokenData[][], replacements: Map<string, string>): string {
  let output = "";

  tokenMatrix.forEach((tokens) => {
    tokens.forEach((token) => {
      const key = `${token.sentenceIndex}:${token.tokenIndex}`;
      const rendered = replacements.get(key) ?? token.text;
      output += `${token.precedingSpaces}${rendered}`;
    });
  });

  return output;
}

async function getNlpInstance(): Promise<WinkMethods> {
  if (nlpInstance) {
    return nlpInstance;
  }

  if (!initPromise) {
    initPromise = Promise.resolve()
      .then(() => {
        nlpInstance = winkNLP(model);
        return nlpInstance;
      })
      .catch((error) => {
        initPromise = null;
        throw error;
      });
  }

  return initPromise;
}

export async function resolvePronouns(
  story: string,
  options: ResolvePronounsOptions = {},
): Promise<ResolverResult> {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  if (story.length > maxChars) {
    return getEmptyResult(story, "input_too_long");
  }

  try {
    const nlp = await getNlpInstance();
    const tokenMatrix = buildTokenMatrix(nlp, story);
    const personMentions = buildPersonMentions(tokenMatrix);
    const globalHints = collectGlobalHints(tokenMatrix, personMentions);

    const replacements = new Map<string, string>();
    const applied: ResolverResult["applied"] = [];

    let pronounsFound = 0;
    let pronounsResolved = 0;
    let pronounsSkipped = 0;

    tokenMatrix.forEach((tokens, sentenceIndex) => {
      tokens.forEach((token, tokenIndex) => {
        const trackedPronoun = getTrackedPronoun(tokens, tokenIndex);
        if (!trackedPronoun) {
          return;
        }

        pronounsFound += 1;

        const windowMentions = getWindowMentions(personMentions, sentenceIndex, tokenIndex);
        const distinct = new Map<string, PersonMention[]>();
        windowMentions.forEach((mention) => {
          const existing = distinct.get(mention.normalized) ?? [];
          existing.push(mention);
          distinct.set(mention.normalized, existing);
        });

        const filteredDistinct =
          trackedPronoun.role === "object"
            ? filterObjectPronounCandidates(distinct, sentenceIndex, tokenIndex)
            : distinct;

        if (filteredDistinct.size !== 1) {
          pronounsSkipped += 1;
          return;
        }

        const [normalizedName, mentionsForName] = Array.from(filteredDistinct.entries())[0];
        const hint = globalHints.get(normalizedName) ?? "unknown";
        if (!canResolvePronoun(trackedPronoun.className, hint)) {
          pronounsSkipped += 1;
          return;
        }

        const canonicalMention = mentionsForName.sort((a, b) => {
          if (a.sentenceIndex !== b.sentenceIndex) {
            return b.sentenceIndex - a.sentenceIndex;
          }
          return b.tokenIndex - a.tokenIndex;
        })[0];

        const key = `${sentenceIndex}:${tokenIndex}`;
        replacements.set(key, canonicalMention.text);
        pronounsResolved += 1;

        applied.push({
          pronoun: trackedPronoun.pronoun,
          position: {
            sentenceIndex,
            tokenIndex,
          },
          replacement: canonicalMention.text,
          confidence: "high",
        });
      });
    });

    return {
      resolvedStory: buildResolvedStory(tokenMatrix, replacements),
      stats: {
        pronounsFound,
        pronounsResolved,
        pronounsSkipped,
      },
      applied,
    };
  } catch {
    return getEmptyResult(story, "model_failure");
  }
}

export function __resetPronounResolverForTests(): void {
  nlpInstance = null;
  initPromise = null;
}
