import React, { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  SearchRemoveIcon,
  CheckmarkCircle02Icon,
  WalkingIcon,
  BookmarkAdd01Icon,
  BookmarkCheck01Icon,
} from "@hugeicons/core-free-icons";
import { MAX_NAME_LENGTH } from "../storage/savedSearches.ts";
import type { Place, RouteSuggestion, WalkUnit } from "../types.ts";
import { WALK_LIMITS, formatBudget } from "../walk.ts";
import "./SearchPanel.css";
import PlaceInput from "./PlaceInput.tsx";
import WalkSlider from "./WalkSlider.tsx";

interface SearchPanelProps {
  originName: string;
  destName: string;
  walkUnit: WalkUnit;
  originBudget: number;
  destBudget: number;
  linkedWalk: boolean;
  onSetOrigin: (place: Place) => void;
  onSetDest: (place: Place) => void;
  onClearOrigin: () => void;
  onClearDest: () => void;
  onWalkUnitChange: (unit: WalkUnit) => void;
  onOriginBudgetChange: (value: number) => void;
  onDestBudgetChange: (value: number) => void;
  onLinkedWalkChange: (checked: boolean) => void;
  onSearch: () => void;
  onReset: () => void;
  loading: boolean;
  error: string | null;
  routeCount: number | null;
  suggestion: RouteSuggestion | null;
  onApplySuggestion: () => void;
  canSave: boolean;
  savedName: string | null;
  suggestedName: string;
  onSave: (name: string) => void;
}

function SearchPanel({
  originName,
  destName,
  walkUnit,
  originBudget,
  destBudget,
  linkedWalk,
  onSetOrigin,
  onSetDest,
  onClearOrigin,
  onClearDest,
  onWalkUnitChange,
  onOriginBudgetChange,
  onDestBudgetChange,
  onLinkedWalkChange,
  onSearch,
  onReset,
  loading,
  error,
  routeCount,
  suggestion,
  onApplySuggestion,
  canSave,
  savedName,
  suggestedName,
  onSave,
}: SearchPanelProps) {
  const canSearch = Boolean(originName && destName && !loading);
  const limits = WALK_LIMITS[walkUnit];
  const unitToggle = (
    <div
      className="unit-toggle"
      role="radiogroup"
      aria-label="Unidad de caminata"
      data-active={walkUnit}
    >
      {(["meters", "minutes"] as const).map((u) => (
        <button
          key={u}
          type="button"
          role="radio"
          aria-checked={walkUnit === u}
          className={`unit-option ${walkUnit === u ? "active" : ""}`}
          onClick={() => onWalkUnitChange(u)}
        >
          {u === "minutes" ? "min" : "m"}
        </button>
      ))}
    </div>
  );
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  // Close the name form when the points change or the search gets saved.
  useEffect(() => {
    setSaveOpen(false);
  }, [originName, destName, savedName]);

  function openSaveForm() {
    setSaveName(suggestedName);
    setSaveOpen(true);
  }

  function submitSave() {
    const name = saveName.trim();
    if (!name) return;
    onSave(name);
    setSaveOpen(false);
  }

  function handleSaveKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSaveOpen(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (canSearch) onSearch();
  }

  return (
    <div className="search-panel">
      <form className="panel-body" onSubmit={handleSubmit}>
        <div className="points-card">
          <PlaceInput
            label="Origen"
            color="var(--color-origin)"
            value={originName}
            placeholder="Buscar dirección de origen..."
            onSelect={onSetOrigin}
            onClear={onClearOrigin}
          />
          <div className="divider-line" />
          <PlaceInput
            label="Destino"
            color="var(--color-destination)"
            value={destName}
            placeholder="Buscar dirección de destino..."
            onSelect={onSetDest}
            onClear={onClearDest}
          />
        </div>

        <p className="map-tip">
          También podés hacer clic en el mapa para marcar los puntos.
        </p>

        <div className="radius-section">
          <div className="radius-options">
            <label className="radius-link-row">
              <input
                type="checkbox"
                checked={linkedWalk}
                onChange={(e) => onLinkedWalkChange(e.target.checked)}
                className="radius-link-checkbox"
              />
              <span>Misma caminata para ambos</span>
            </label>
            {unitToggle}
          </div>

          {linkedWalk ? (
            <div className="radius-slider-block">
              <div className="radius-header">
                <span className="radius-label">Caminata máxima</span>
                <span className="radius-value">
                  {formatBudget(walkUnit, originBudget)}
                </span>
              </div>
              <WalkSlider
                min={limits.min}
                max={limits.max}
                step={limits.step}
                value={originBudget}
                onChange={onOriginBudgetChange}
                aria-label="Caminata máxima"
              />
              <div className="radius-ticks">
                <span>{formatBudget(walkUnit, limits.min)}</span>
                <span>
                  {formatBudget(walkUnit, (limits.min + limits.max) / 2)}
                </span>
                <span>{formatBudget(walkUnit, limits.max)}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="radius-slider-block radius-origin">
                <div className="radius-header">
                  <span className="radius-label">Caminata en origen</span>
                  <span className="radius-value radius-value-origin">
                    {formatBudget(walkUnit, originBudget)}
                  </span>
                </div>
                <WalkSlider
                  min={limits.min}
                  max={limits.max}
                  step={limits.step}
                  value={originBudget}
                  onChange={onOriginBudgetChange}
                  aria-label="Caminata en origen"
                />
              </div>
              <div className="radius-slider-block radius-dest">
                <div className="radius-header">
                  <span className="radius-label">Caminata en destino</span>
                  <span className="radius-value radius-value-dest">
                    {formatBudget(walkUnit, destBudget)}
                  </span>
                </div>
                <WalkSlider
                  min={limits.min}
                  max={limits.max}
                  step={limits.step}
                  value={destBudget}
                  onChange={onDestBudgetChange}
                  aria-label="Caminata en destino"
                />
              </div>
            </>
          )}
        </div>

        <div className="action-row">
          <button type="submit" className="btn-primary" disabled={!canSearch}>
            {loading ? (
              <span className="loading-inline">
                <span className="spinner" />
                Buscando...
              </span>
            ) : (
              "Buscar rutas"
            )}
          </button>
          <button type="button" className="btn-ghost" onClick={onReset}>
            Limpiar
          </button>
          {savedName ? (
            <span
              className="btn-icon is-saved"
              role="img"
              aria-label={`Guardada como ${savedName}`}
              title={`Guardada como «${savedName}»`}
            >
              <HugeiconsIcon
                icon={BookmarkCheck01Icon}
                size={18}
                color="currentColor"
                strokeWidth={1.75}
              />
            </span>
          ) : (
            <button
              type="button"
              className="btn-icon"
              onClick={saveOpen ? () => setSaveOpen(false) : openSaveForm}
              disabled={!canSave}
              aria-expanded={saveOpen}
              aria-label="Guardar búsqueda"
              title="Guardar búsqueda"
            >
              <HugeiconsIcon
                icon={BookmarkAdd01Icon}
                size={18}
                color="currentColor"
                strokeWidth={1.75}
              />
            </button>
          )}
        </div>
      </form>

      {saveOpen && canSave && !savedName ? (
        <div className="save-form">
          <label className="save-form-label" htmlFor="save-search-name">
            Nombre para esta búsqueda
          </label>
          <div className="save-form-row">
            <input
              id="save-search-name"
              className="save-form-input"
              type="text"
              value={saveName}
              maxLength={MAX_NAME_LENGTH}
              placeholder="Ej: Casa → Trabajo"
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={handleSaveKeyDown}
              autoFocus
            />
            <button
              type="button"
              className="save-form-btn"
              onClick={submitSave}
              disabled={!saveName.trim()}
            >
              Guardar
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="feedback error">
          <HugeiconsIcon
            icon={Alert02Icon}
            size={14}
            color="currentColor"
            strokeWidth={1.75}
            className="feedback-icon"
          />
          <span>{error}</span>
        </div>
      ) : null}

      {routeCount !== null && !loading && !error ? (
        <div className={`feedback ${routeCount === 0 ? "warning" : "success"}`}>
          {routeCount === 0 ? (
            <div className="feedback-content-vertical">
              <div className="feedback-message-row">
                <HugeiconsIcon
                  icon={SearchRemoveIcon}
                  size={14}
                  color="currentColor"
                  strokeWidth={1.75}
                  className="feedback-icon"
                />
                <span>Ninguna línea directa en esta zona.</span>
              </div>
              {suggestion ? (
                <button
                  type="button"
                  className="suggestion-btn"
                  onClick={onApplySuggestion}
                >
                  <HugeiconsIcon
                    icon={WalkingIcon}
                    size={12}
                    color="currentColor"
                    strokeWidth={1.75}
                    className="suggestion-icon"
                  />
                  <span>
                    Ver {suggestion.count}{" "}
                    {suggestion.count === 1 ? "línea" : "líneas"} caminando{" "}
                    {linkedWalk
                      ? formatBudget(suggestion.unit, suggestion.originBudget)
                      : `${formatBudget(suggestion.unit, suggestion.originBudget)} / ${formatBudget(suggestion.unit, suggestion.destBudget)}`}
                  </span>
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={14}
                color="currentColor"
                strokeWidth={1.75}
                className="feedback-icon"
              />
              <span>
                {routeCount === 1 ? (
                  "Se encontró 1 línea."
                ) : (
                  <>
                    Se encontraron <strong>{routeCount}</strong> líneas.
                  </>
                )}
              </span>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default SearchPanel;
