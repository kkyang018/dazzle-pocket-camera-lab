import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
/** 看图配线 / 配贴纸用的视觉模型 */
export const VISION_MODEL = "google/gemini-3.8-flash";

export function createGateway(lovableApiKey: string) {
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  return createOpenAICompatible({
    name: "lovable",
    baseURL: GATEWAY_URL,
    supportsStructuredOutputs: false,
    headers: { "Lovable-API-Key": lovableApiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
}
