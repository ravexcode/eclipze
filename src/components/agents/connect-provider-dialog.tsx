"use client";

import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";

// Explains how to get a provider before starting a task. Users with no provider are asked
// to connect one; users with providers but no OpenRouter are asked to mention an agent.
export default function ConnectProviderDialog(props: {
  isOpen: boolean;
  hasConnectedProvider: boolean;
  onClose(): void;
}) {
  const description = props.hasConnectedProvider
    ? "Tasks without an agent mention run on OpenRouter, which is not connected. Mention one of your agents with @, or connect OpenRouter in Settings."
    : "Eclipze-funded AI is temporarily paused. Connect your own provider, such as Claude, OpenAI, OpenRouter, or Ollama, to start agent tasks.";

  return (
    <Dialog
      isOpen={props.isOpen}
      title={props.hasConnectedProvider ? "Mention an agent or connect OpenRouter" : "Connect your AI provider"}
      description={description}
      onClose={props.onClose}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={props.onClose}>
          Not now
        </Button>
        <Button
          href="/profile/settings"
          variant="main">
          Open Settings
        </Button>
      </div>
    </Dialog>
  );
}
