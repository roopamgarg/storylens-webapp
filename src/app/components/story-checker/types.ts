import type { ErrorCode } from "@/lib/contracts";
import type { ResolverResult } from "@/lib/pronoun-resolver";

export type UiError = {
  code: ErrorCode | "NETWORK_ERROR";
  message: string;
  requestId?: string;
};

export type PreviewStats = ResolverResult["stats"] & {
  skipReason?: ResolverResult["skipReason"] | null;
};
