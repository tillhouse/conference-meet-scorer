export type PromptContext = "meet" | "team" | "general";

export interface StrategyPrompt {
  label: string;
  prompt: string;
  context: PromptContext;
}

export const STRATEGY_PROMPTS: StrategyPrompt[] = [
  {
    label: "Who is most at risk of losing points?",
    prompt: "Who is most at risk of losing points if they swim a bit slower or score a bit lower?",
    context: "meet",
  },
  {
    label: "Who can gain the most by improving?",
    prompt: "Who is best positioned to gain a lot of points by doing slightly better?",
    context: "meet",
  },
  {
    label: "Test spot: compare impact on team total",
    prompt: "Summarize our test spot options and how the team total changes depending on who we use. Who do you recommend should score?",
    context: "meet",
  },
  {
    label: "Which events to double up for max points?",
    prompt: "Which events should we double up in for maximum points?",
    context: "meet",
  },
  {
    label: "Relay vs individual tradeoffs",
    prompt: "How do our relay choices affect team total compared to individual events?",
    context: "meet",
  },
  {
    label: "Which team is most at risk?",
    prompt: "Which team is most threatened by small drops in performance?",
    context: "meet",
  },
  {
    label: "Optimize this meet",
    prompt: "How should I optimize lineups and entries for this meet?",
    context: "meet",
  },
  {
    label: "Best lineup strategy",
    prompt: "What's the best lineup strategy for this meet given the current standings and results?",
    context: "meet",
  },
  {
    label: "Who are our best athletes?",
    prompt: "Who are our best athletes and what events should we focus on?",
    context: "team",
  },
  {
    label: "Roster strategy",
    prompt: "What's the best roster strategy for a championship meet?",
    context: "general",
  },
];

export function getPromptsForContext(context: PromptContext | null): StrategyPrompt[] {
  if (!context) return STRATEGY_PROMPTS.filter((p) => p.context === "general");
  return STRATEGY_PROMPTS.filter(
    (p) => p.context === context || p.context === "general"
  );
}
