import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { resolvePronouns } from "../src/lib/pronoun-resolver";

type BenchmarkResult = {
  corpusSize: number;
  p99DurationMs: number;
  averageDurationMs: number;
  maxDurationMs: number;
  rssDeltaMb: number;
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function seededRandom(seed: number): () => number {
  let current = seed >>> 0;
  return () => {
    current = (1664525 * current + 1013904223) >>> 0;
    return current / 0x100000000;
  };
}

function buildSyntheticStory(seed: number): string {
  const rand = seededRandom(seed);
  const names = ["Aria", "Borin", "Cora", "Dain", "Elin", "Faris"];
  const pronounParagraph =
    "Aria met Borin near Cora. He warned them about the bridge. She thanked him and they moved quickly. The guard watched her while them remained unseen.";

  let story = "";
  while (story.length < 7_500) {
    const a = names[Math.floor(rand() * names.length)] ?? "Aria";
    const b = names[Math.floor(rand() * names.length)] ?? "Borin";
    const c = names[Math.floor(rand() * names.length)] ?? "Cora";
    const paragraph = pronounParagraph
      .replace("Aria", a)
      .replace("Borin", b)
      .replace("Cora", c);
    story += `${paragraph} `;
  }

  return story.slice(0, 8_500);
}

function loadCorpus(): string[] {
  const storiesDir = join(process.cwd(), "..", "llm-layer", "examples", "stories");
  const storyFiles = readdirSync(storiesDir).filter((file) => file.endsWith(".txt"));

  const corpus = storyFiles.map((file) => readFileSync(join(storiesDir, file), "utf8").trim());

  for (let index = 0; index < 5; index += 1) {
    corpus.push(buildSyntheticStory(1000 + index));
  }

  while (corpus.length < 100) {
    corpus.push(corpus[corpus.length % storyFiles.length] ?? buildSyntheticStory(2000 + corpus.length));
  }

  return corpus;
}

async function runBenchmark(): Promise<BenchmarkResult> {
  const corpus = loadCorpus();

  const rssBefore = process.memoryUsage().rss;
  await resolvePronouns(corpus[0] ?? "", { maxChars: 10_000 });
  const rssAfterWarmup = process.memoryUsage().rss;

  const durations: number[] = [];
  for (const story of corpus) {
    const started = performance.now();
    await resolvePronouns(story, { maxChars: 10_000 });
    durations.push(performance.now() - started);
  }

  const sum = durations.reduce((acc, value) => acc + value, 0);
  const max = durations.reduce((acc, value) => Math.max(acc, value), 0);

  return {
    corpusSize: corpus.length,
    p99DurationMs: Number(percentile(durations, 99).toFixed(2)),
    averageDurationMs: Number((sum / durations.length).toFixed(2)),
    maxDurationMs: Number(max.toFixed(2)),
    rssDeltaMb: Number(((rssAfterWarmup - rssBefore) / (1024 * 1024)).toFixed(2)),
  };
}

runBenchmark()
  .then((result) => {
    console.log(JSON.stringify({ event: "pronoun_resolver_benchmark", ...result }));
    if (result.p99DurationMs > 50) {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
