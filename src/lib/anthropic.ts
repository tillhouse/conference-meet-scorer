import Anthropic from "@anthropic-ai/sdk";

// Initialize Anthropic client
// The API key is read from ANTHROPIC_API_KEY environment variable
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

// Helper to check if API key is configured
export function isAnthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Helper to get model name (can be configured via env var or default)
// Available models: claude-3-opus-20240229, claude-3-sonnet-20240229, claude-3-haiku-20240307
// Claude 3 Haiku is the fastest and most cost-effective option
export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307";
}
