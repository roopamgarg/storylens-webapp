# Pronoun Evaluation Corpus

Each JSON file contains:

- `story`: source narrative text.
- `mentions[]`: expected pronoun behavior annotations.

Annotation guideline:

- Mark `expectedAction: "resolve"` only when exactly one PERSON-like antecedent is in a 3-sentence lookback window and resolver agreement rules permit replacement.
- Mark `expectedAction: "skip"` for ambiguous multi-candidate windows, zero-candidate windows, possessive forms excluded in Phase 1, or explicit agreement conflicts.
- Include `expectedReplacement` only when action is `"resolve"`.
- `sentenceIndex` and `tokenIndex` are 0-based positions in wink sentence/token segmentation.
