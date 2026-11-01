import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { SERVICE_AI_PAUSED, SERVICE_AI_PAUSED_MESSAGE } from "@/constants/openrouter";
import { getOpenRouterCredential, getOpenRouterModels } from "@/lib/openrouter";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  try {
    const credential = await getOpenRouterCredential(user.id);
    if (!credential) {
      return NextResponse.json(
        {
          message: SERVICE_AI_PAUSED
            ? SERVICE_AI_PAUSED_MESSAGE
            : "Connect OpenRouter in Settings or configure the Eclipse service connection.",
        },
        { status: 404, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }

    const models = await getOpenRouterModels(credential.apiKey);
    return NextResponse.json({
      models: models.map(model => ({
        id: model.id,
        name: model.name,
        provider: "OPENROUTER",
        inputPricePerToken: model.pricing.prompt,
        outputPricePerToken: model.pricing.completion,
      })),
    }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach OpenRouter right now.";
    return NextResponse.json({ message }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
  }
}
