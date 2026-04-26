import { describe, expect, it, vi } from "vitest";

import { __resetPronounResolverForTests, resolvePronouns } from "@/lib/pronoun-resolver";

describe("resolvePronouns", () => {
  it("no-pronoun pass-through", async () => {
    const input = "Aria found a map.";
    const result = await resolvePronouns(input);

    expect(result.resolvedStory).toBe(input);
    expect(result.stats.pronounsFound).toBe(0);
    expect(result.applied).toHaveLength(0);
  });

  it("possessive not tracked", async () => {
    const input = "Boromir drew his sword.";
    const result = await resolvePronouns(input);

    expect(result.resolvedStory).toBe(input);
    expect(result.stats.pronounsFound).toBe(0);
  });

  it("single antecedent", async () => {
    const input = "Boromir drew his sword. He charged forward.";
    const result = await resolvePronouns(input);

    expect(result.resolvedStory).toBe("Boromir drew his sword. Boromir charged forward.");
    expect(result.stats.pronounsResolved).toBeGreaterThanOrEqual(1);
    expect(result.applied.length).toBeGreaterThanOrEqual(1);
  });

  it("ambiguous multi-candidate", async () => {
    const input = "Frodo saw Aragorn. He smiled.";
    const result = await resolvePronouns(input);

    expect(result.resolvedStory).toBe(input);
    expect(result.stats.pronounsSkipped).toBeGreaterThanOrEqual(1);
  });

  it("possessive her skip", async () => {
    const input = "Aria tightened her grip.";
    const result = await resolvePronouns(input);

    expect(result.resolvedStory).toBe(input);
    expect(result.stats.pronounsFound).toBe(0);
  });

  it("they plural ambiguity", async () => {
    const input = "Gandalf spoke to Frodo and Sam. They listened.";
    const result = await resolvePronouns(input);

    expect(result.resolvedStory).toBe(input);
    expect(result.stats.pronounsSkipped).toBeGreaterThanOrEqual(1);
  });

  it("they single candidate", async () => {
    const input = "Alex entered the room. They sat down.";
    const result = await resolvePronouns(input);

    expect(result.resolvedStory).toBe("Alex entered the room. Alex sat down.");
  });

  it("him resolves single antecedent", async () => {
    const input = "Boromir stood alone. The arrow struck him.";
    const result = await resolvePronouns(input);

    expect(result.resolvedStory).toBe("Boromir stood alone. The arrow struck Boromir.");
  });

  it("she resolves single antecedent", async () => {
    const input = "Aria entered the hall. She looked around.";
    const result = await resolvePronouns(input);

    expect(result.resolvedStory).toBe("Aria entered the hall. Aria looked around.");
  });

  it("object her resolves (PRP-like)", async () => {
    const input = "Aria walked in. The light struck her.";
    const result = await resolvePronouns(input);

    expect(result.resolvedStory).toBe("Aria walked in. The light struck Aria.");
  });

  it("them resolves single antecedent", async () => {
    const input = "Alex stood apart. The crowd ignored them.";
    const result = await resolvePronouns(input);

    expect(result.resolvedStory).toBe("Alex stood apart. The crowd ignored Alex.");
  });

  it("he-without-hint resolves by single-candidate carve-out", async () => {
    const input = "Aria entered. He waited.";
    const result = await resolvePronouns(input);

    expect(result.resolvedStory).toBe("Aria entered. Aria waited.");
    expect(result.stats.pronounsResolved).toBeGreaterThanOrEqual(1);
  });

  it("zero-person window", async () => {
    const input = "The wind howled. He ran.";
    const result = await resolvePronouns(input);

    expect(result.resolvedStory).toBe(input);
    expect(result.stats.pronounsSkipped).toBeGreaterThanOrEqual(1);
  });

  it("she-with-masc-hint conflict skip while he resolves", async () => {
    const input = "Borin said he was ready. She moved forward.";
    const result = await resolvePronouns(input);

    expect(result.resolvedStory).toBe("Borin said Borin was ready. She moved forward.");
    expect(result.stats.pronounsResolved).toBeGreaterThanOrEqual(1);
    expect(result.stats.pronounsSkipped).toBeGreaterThanOrEqual(1);
  });

  it("conflict downgrade to unknown still resolves via carve-out path", async () => {
    const input = "Alex said he was ready. Alex then told her to hurry. They waited.";
    const result = await resolvePronouns(input);

    expect(result.resolvedStory).toBe("Alex said Alex was ready. Alex then told Alex to hurry. Alex waited.");
    expect(result.stats.pronounsResolved).toBeGreaterThanOrEqual(3);
  });

  it("length skip", async () => {
    const input = "a".repeat(11);
    const result = await resolvePronouns(input, { maxChars: 10 });

    expect(result.resolvedStory).toBe(input);
    expect(result.skipReason).toBe("input_too_long");
  });

  it("model failure", async () => {
    vi.resetModules();
    vi.doMock("wink-nlp", () => ({
      default: () => {
        throw new Error("model failed");
      },
    }));

    const mockedModule = await import("@/lib/pronoun-resolver");
    const result = await mockedModule.resolvePronouns("Aria entered.");

    expect(result.skipReason).toBe("model_failure");

    vi.doUnmock("wink-nlp");
    vi.resetModules();
    __resetPronounResolverForTests();
  });

  it("POS mis-tag canary (mocked)", async () => {
    vi.resetModules();

    const posRef = Symbol("pos");
    const spacesRef = Symbol("spaces");

    const makeToken = (text: string, pos: string, spaces: string) => ({
      out: (selector?: unknown) => {
        if (selector === posRef) {
          return pos;
        }
        if (selector === spacesRef) {
          return spaces;
        }
        return text;
      },
    });

    const sentenceTokens = [
      makeToken("Aria", "PROPN", ""),
      makeToken("tightened", "VERB", " "),
      makeToken("her", "PRON", " "),
      makeToken("grip", "VERB", " "),
      makeToken(".", "PUNCT", ""),
    ];

    const mockNlp = {
      its: {
        pos: posRef,
        precedingSpaces: spacesRef,
      },
      readDoc: () => ({
        sentences: () => ({
          each: (cb: (sentence: { tokens: () => { each: (tokenCb: (token: unknown, index: number) => void) => void } }, index: number) => void) => {
            cb(
              {
                tokens: () => ({
                  each: (tokenCb: (token: unknown, index: number) => void) => {
                    sentenceTokens.forEach((token, index) => tokenCb(token, index));
                  },
                }),
              },
              0,
            );
          },
        }),
      }),
    };

    vi.doMock("wink-nlp", () => ({
      default: () => mockNlp,
    }));

    const mockedModule = await import("@/lib/pronoun-resolver");
    const result = await mockedModule.resolvePronouns("Aria tightened her grip.");

    expect(result.resolvedStory).toBe("Aria tightened Aria grip.");

    vi.doUnmock("wink-nlp");
    vi.resetModules();
    __resetPronounResolverForTests();
  });
});
