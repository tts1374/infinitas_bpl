import { useState } from "react";
import { runtimeConfig } from "../runtime/runtime-config";
import {
  injectDebugTemplate,
  submitParsedSourceChange,
} from "../services/source-submission";
import { useRoomStore } from "../stores/room-store";
import { DEBUG_INJECTION_FIXTURES } from "../debug/testdata";
import { parseDebugInjectionJson } from "../debug/types";

interface DebugOutcomeState {
  tone: "ok" | "danger";
  source: string;
  message: string;
}

function formatExpectedKey(
  expectedKey:
    | {
        play_style: string;
        difficulty: string;
        title_search_key: string;
      }
    | null
    | undefined,
): string {
  if (!expectedKey) {
    return "-";
  }

  return `${expectedKey.play_style} / ${expectedKey.difficulty} / ${expectedKey.title_search_key}`;
}

export function DebugInjectionPanel() {
  const snapshot = useRoomStore((state) => state.snapshot);
  const currentRound = snapshot?.current_round ?? null;
  const [selectedFileName, setSelectedFileName] = useState(
    DEBUG_INJECTION_FIXTURES[0]?.fileName ?? "",
  );
  const [editorText, setEditorText] = useState(
    DEBUG_INJECTION_FIXTURES[0]?.rawJson ?? "",
  );
  const [outcome, setOutcome] = useState<DebugOutcomeState | null>(null);

  if (!runtimeConfig.debugUiEnabled || snapshot?.room_state !== "PLAYING" || currentRound === null) {
    return null;
  }

  const selectedFixture =
    DEBUG_INJECTION_FIXTURES.find((fixture) => fixture.fileName === selectedFileName) ?? null;

  return (
    <section className="panel-subsection debug-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Debug</p>
          <h3>JSON injection</h3>
        </div>
        <span className="status-pill warning">DEV ONLY</span>
      </div>

      <p className="status-muted">
        Selected instance: {runtimeConfig.instanceLabel} / expected key:{" "}
        {formatExpectedKey(currentRound.expected_key)}
      </p>

      <div className="split-panel debug-grid">
        <section className="status-stack debug-card">
          <label className="field">
            <span>Bundled test case</span>
            <select
              value={selectedFileName}
              onChange={(event) => {
                setSelectedFileName(event.currentTarget.value);
              }}
            >
              {DEBUG_INJECTION_FIXTURES.map((fixture) => (
                <option key={fixture.fileName} value={fixture.fileName}>
                  {fixture.fileName}
                </option>
              ))}
            </select>
          </label>

          <strong>{selectedFixture?.template.case_name ?? "-"}</strong>
          <span className="status-muted">{selectedFixture?.template.description ?? "No case selected."}</span>
          <span className="status-muted">
            Target:{" "}
            {selectedFixture
              ? `${selectedFixture.template.target_room.mode} / ${selectedFixture.template.target_room.win_metric} / ${selectedFixture.template.target_room.play_style}`
              : "-"}
          </span>

          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              disabled={selectedFixture === null}
              onClick={() => {
                if (selectedFixture === null) {
                  return;
                }

                setEditorText(selectedFixture.rawJson);
                setOutcome({
                  tone: "ok",
                  source: selectedFixture.fileName,
                  message: "Loaded selected test case into the editor.",
                });
              }}
            >
              Load case JSON
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={selectedFixture === null}
              onClick={() => {
                if (selectedFixture === null) {
                  return;
                }

                const nextOutcome = injectDebugTemplate(
                  selectedFixture.template,
                  selectedFixture.fileName,
                );
                setOutcome({
                  tone: nextOutcome.ok ? "ok" : "danger",
                  source: selectedFixture.fileName,
                  message: nextOutcome.message,
                });
              }}
            >
              Inject selected case
            </button>
          </div>
        </section>

        <section className="status-stack debug-card">
          <label className="field">
            <span>JSON editor</span>
            <textarea
              rows={14}
              value={editorText}
              onChange={(event) => {
                setEditorText(event.currentTarget.value);
              }}
              placeholder='{"kind":"result-template", ...}'
            />
          </label>

          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                const parsed = parseDebugInjectionJson(editorText);
                if (!parsed.ok) {
                  setOutcome({
                    tone: "danger",
                    source: "Editor JSON",
                    message: parsed.message,
                  });
                  return;
                }

                const nextOutcome =
                  parsed.value.kind === "template"
                    ? injectDebugTemplate(parsed.value.template, "editor.json")
                    : submitParsedSourceChange(parsed.value.parsedChange, "editor.json");
                setOutcome({
                  tone: nextOutcome.ok ? "ok" : "danger",
                  source: "Editor JSON",
                  message: nextOutcome.message,
                });
              }}
            >
              Inject editor JSON
            </button>
          </div>
        </section>
      </div>

      <div className="meta-strip debug-status-strip">
        <span>Loaded file: {selectedFixture?.fileName ?? "-"}</span>
        <span>Current round: #{currentRound.round_index + 1}</span>
      </div>

      {outcome ? (
        <div className={`debug-outcome ${outcome.tone}`}>
          <strong>{outcome.source}</strong>
          <span>{outcome.message}</span>
        </div>
      ) : null}
    </section>
  );
}
