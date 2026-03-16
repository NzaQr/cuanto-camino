import React from "react";
import {
  Bus,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  SearchX,
  CheckCircle2,
  Footprints,
} from "lucide-react";
import type { Place, RouteSuggestion } from "../types.ts";
import "./SearchPanel.css";
import PlaceInput from "./PlaceInput.tsx";

const WALK_MIN = 100;
const WALK_MAX = 2000;

interface SearchPanelProps {
  originName: string;
  destName: string;
  originRadius: number;
  destRadius: number;
  linkedRadius: boolean;
  onSetOrigin: (place: Place) => void;
  onSetDest: (place: Place) => void;
  onClearOrigin: () => void;
  onClearDest: () => void;
  onOriginRadiusChange: (value: number) => void;
  onDestRadiusChange: (value: number) => void;
  onLinkedRadiusChange: (checked: boolean) => void;
  onSearch: () => void;
  onReset: () => void;
  loading: boolean;
  error: string | null;
  routeCount: number | null;
  panelOpen: boolean;
  onTogglePanel: () => void;
  suggestion: RouteSuggestion | null;
  onApplySuggestion: () => void;
}

function SearchPanel({
  originName,
  destName,
  originRadius,
  destRadius,
  linkedRadius,
  onSetOrigin,
  onSetDest,
  onClearOrigin,
  onClearDest,
  onOriginRadiusChange,
  onDestRadiusChange,
  onLinkedRadiusChange,
  onSearch,
  onReset,
  loading,
  error,
  routeCount,
  panelOpen,
  onTogglePanel,
  suggestion,
  onApplySuggestion,
}: SearchPanelProps) {
  const canSearch = Boolean(originName && destName && !loading);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (canSearch) onSearch();
  }

  return (
    <div className="search-panel">
      <div
        className="panel-header"
        role="button"
        tabIndex={0}
        onClick={onTogglePanel}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTogglePanel();
          }
        }}
        aria-label={panelOpen ? "Cerrar menú" : "Abrir menú"}
      >
        <div className="panel-icon">
          <Bus size={20} />
        </div>
        <div>
          <h1 className="panel-title">Cuánto Camino</h1>
          <p className="panel-subtitle">Encontrá tu línea</p>
        </div>
        <span className="panel-toggle-chevron">
          {panelOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </span>
      </div>

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
          <label className="radius-link-row">
            <input
              type="checkbox"
              checked={linkedRadius}
              onChange={(e) => onLinkedRadiusChange(e.target.checked)}
              className="radius-link-checkbox"
            />
            <span>Mismo radio para ambos</span>
          </label>

          {linkedRadius ? (
            <div className="radius-slider-block">
              <div className="radius-header">
                <span className="radius-label">Radio de caminata</span>
                <span className="radius-value">{originRadius}m</span>
              </div>
              <input
                type="range"
                min={WALK_MIN}
                max={WALK_MAX}
                step={50}
                value={originRadius}
                onChange={(e) => onOriginRadiusChange(Number(e.target.value))}
              />
              <div className="radius-ticks">
                <span>{WALK_MIN}m</span>
                <span>{WALK_MAX / 2}m</span>
                <span>{WALK_MAX}m</span>
              </div>
            </div>
          ) : (
            <>
              <div className="radius-slider-block radius-origin">
                <div className="radius-header">
                  <span className="radius-label">Radio origen</span>
                  <span className="radius-value radius-value-origin">
                    {originRadius}m
                  </span>
                </div>
                <input
                  type="range"
                  min={WALK_MIN}
                  max={WALK_MAX}
                  step={50}
                  value={originRadius}
                  onChange={(e) => onOriginRadiusChange(Number(e.target.value))}
                />
              </div>
              <div className="radius-slider-block radius-dest">
                <div className="radius-header">
                  <span className="radius-label">Radio destino</span>
                  <span className="radius-value radius-value-dest">
                    {destRadius}m
                  </span>
                </div>
                <input
                  type="range"
                  min={WALK_MIN}
                  max={WALK_MAX}
                  step={50}
                  value={destRadius}
                  onChange={(e) => onDestRadiusChange(Number(e.target.value))}
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
        </div>
      </form>

      {error ? (
        <div className="feedback error">
          <AlertTriangle size={14} className="feedback-icon" />
          <span>{error}</span>
        </div>
      ) : null}

      {routeCount !== null && !loading && !error ? (
        <div className={`feedback ${routeCount === 0 ? "warning" : "success"}`}>
          {routeCount === 0 ? (
            <div className="feedback-content-vertical">
              <div className="feedback-message-row">
                <SearchX size={14} className="feedback-icon" />
                <span>Ninguna línea directa en esta zona.</span>
              </div>
              {suggestion ? (
                <button
                  type="button"
                  className="suggestion-btn"
                  onClick={onApplySuggestion}
                >
                  <Footprints size={12} className="suggestion-icon" />
                  <span>
                    Ver {suggestion.count}{" "}
                    {suggestion.count === 1 ? "línea" : "líneas"} caminando{" "}
                    {linkedRadius
                      ? `${suggestion.originRadius}m`
                      : `${suggestion.originRadius}m / ${suggestion.destRadius}m`}
                  </span>
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <CheckCircle2 size={14} className="feedback-icon" />
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
