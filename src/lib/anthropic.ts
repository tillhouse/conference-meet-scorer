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
// Default: Claude Sonnet 4.6 for strong strategy/reasoning. Override with ANTHROPIC_MODEL (e.g. claude-sonnet-4-5).
export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
}
