import React, { memo } from 'react';
import type { FoundRoute } from '../types.ts';
import './RouteResults.css';

interface RouteCardProps {
  route: FoundRoute;
  isSelected: boolean;
  onSelect: (line: string | null) => void;
}

const RouteCard = memo(function RouteCard({ route, isSelected, onSelect }: RouteCardProps) {
  return (
    <button
      className={`route-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(isSelected ? null : route.line)}
      type="button"
      aria-pressed={isSelected}
    >
      <div className="route-line-badge">{route.line}</div>

      <div className="route-info">
        <div className="route-name">{route.routeDesc || route.routeName}</div>

        <div className="route-stops">
          <div className="stop-row">
            <span className="stop-dot origin" />
            <span className="stop-name">{route.boardStop.name}</span>
            <span className="stop-walk">{route.boardStop.walkMeters}m</span>
          </div>
          <div className="stop-connector" />
          <div className="stop-row">
            <span className="stop-dot dest" />
            <span className="stop-name">{route.alightStop.name}</span>
            <span className="stop-walk">{route.alightStop.walkMeters}m</span>
          </div>
        </div>

        <div className="route-walk-total">
          <span className="walk-icon">🚶</span>
          <span>
            {route.boardStop.walkMeters}m al subir · {route.alightStop.walkMeters}m al bajar
          </span>
        </div>
      </div>

      <div className="route-chevron">{isSelected ? '▲' : '▼'}</div>
    </button>
  );
});

interface RouteResultsProps {
  routes: FoundRoute[];
  selectedLine: string | null;
  onSelectLine: (line: string | null) => void;
}

function RouteResults({ routes, selectedLine, onSelectLine }: RouteResultsProps) {
  return (
    <div className="route-results">
      <div className="results-header">
        <span className="results-count">{routes.length} línea{routes.length !== 1 ? 's' : ''}</span>
        <span className="results-hint">Tocá una para ver el recorrido</span>
      </div>
      <div className="results-list">
        {routes.map((route) => (
          <RouteCard
            key={route.line}
            route={route}
            isSelected={selectedLine === route.line}
            onSelect={onSelectLine}
          />
        ))}
      </div>
    </div>
  );
}

export default RouteResults;
