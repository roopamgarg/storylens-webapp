import { describe, expect, it } from "vitest";

import { resolvePronouns } from "@/lib/pronoun-resolver";

const fixtures = [
  "Aria entered the hall. She looked around.",
  "Frodo saw Aragorn. He smiled.",
  "Alex said he was ready. Alex then told her to hurry. They waited.",
];

describe("pronoun resolver parity fixtures", () => {
  it("returns deterministic byte-for-byte output for repeated invocations", async () => {
    for (const story of fixtures) {
      const first = await resolvePronouns(story, { maxChars: 10_000 });
      const second = await resolvePronouns(story, { maxChars: 10_000 });
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    }
  });
});
