import { NextRequest, NextResponse } from "next/server";
import { anthropic, isAnthropicConfigured, getAnthropicModel } from "@/lib/anthropic";

export async function GET(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!isAnthropicConfigured()) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Try multiple model names to find one that works
    const modelsToTry = [
      "claude-3-sonnet-20240229",
      "claude-3-opus-20240229",
      "claude-3-haiku-20240307",
      "claude-3-5-sonnet-20240620",
      "claude-3-5-sonnet",
    ];

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const message = await anthropic.messages.create({
          model: model,
          max_tokens: 100,
          messages: [
            {
              role: "user",
              content: "Say 'Hello! The API connection is working.' in exactly those words.",
            },
          ],
        });

        const responseText = message.content[0].type === "text" 
          ? message.content[0].text 
          : "Response received but not in text format";

        return NextResponse.json({
          success: true,
          message: responseText,
          model: message.model,
          note: `Working model: ${model}`,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next model
        continue;
      }
    }

    // If we get here, none of the models worked
    throw lastError || new Error("All models failed");
  } catch (error) {
    console.error("Anthropic API test error:", error);
    return NextResponse.json(
      {
        error: "Failed to connect to Anthropic API",
        details: error instanceof Error ? error.message : "Unknown error",
        suggestion: "Check your API key permissions in the Anthropic console. You may need to enable access to specific models.",
      },
      { status: 500 }
    );
  }
}
