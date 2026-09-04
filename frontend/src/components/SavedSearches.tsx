import React, { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Bookmark01Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  Delete02Icon,
  PencilEdit01Icon,
  Tick02Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import type { SavedSearch } from '../types.ts';
import { MAX_NAME_LENGTH, shortPlace } from '../storage/savedSearches.ts';
import { formatBudget } from '../walk.ts';
import './SavedSearches.css';

const CONFIRM_DELETE_MS = 4000;

function walkLabel(s: SavedSearch): string {
  return s.linkedWalk || s.originBudget === s.destBudget
    ? formatBudget(s.unit, s.originBudget)
    : `${formatBudget(s.unit, s.originBudget)} / ${formatBudget(s.unit, s.destBudget)}`;
}

interface SavedSearchItemProps {
  search: SavedSearch;
  isActive: boolean;
  onLoad: (search: SavedSearch) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

function SavedSearchItem({ search, isActive, onLoad, onRename, onRemove }: SavedSearchItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(search.name);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), CONFIRM_DELETE_MS);
    return () => window.clearTimeout(t);
  }, [confirming]);

  function startEdit() {
    setDraft(search.name);
    setEditing(true);
  }

  function commitEdit() {
    const name = draft.trim();
    if (name && name !== search.name) onRename(search.id, name);
    setEditing(false);
  }

  function handleEditKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <li className="saved-item is-editing">
        <div className="saved-edit-row">
          <input
            className="saved-edit-input"
            type="text"
            value={draft}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleEditKey}
            aria-label="Nuevo nombre"
            autoFocus
          />
          <button
            type="button"
            className="saved-icon-btn confirm"
            onClick={commitEdit}
            disabled={!draft.trim()}
            aria-label="Guardar nombre"
          >
            <HugeiconsIcon icon={Tick02Icon} size={16} color="currentColor" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="saved-icon-btn"
            onClick={() => setEditing(false)}
            aria-label="Cancelar"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className={`saved-item${isActive ? ' is-active' : ''}`}>
      <button
        type="button"
        className="saved-main"
        onClick={() => onLoad(search)}
        aria-current={isActive ? 'true' : undefined}
      >
        <span className="saved-name">{search.name}</span>
        <span className="saved-route">
          <span className="saved-dot origin" aria-hidden="true" />
          <span className="saved-place">{shortPlace(search.originName)}</span>
          <span className="saved-arrow" aria-hidden="true">
            →
          </span>
          <span className="saved-dot dest" aria-hidden="true" />
          <span className="saved-place">{shortPlace(search.destName)}</span>
        </span>
        <span className="saved-meta">Caminata {walkLabel(search)}</span>
      </button>

      <div className="saved-actions">
        {confirming ? (
          <button
            type="button"
            className="saved-confirm-delete"
            onClick={() => onRemove(search.id)}
            aria-label={`Confirmar borrar ${search.name}`}
          >
            ¿Borrar?
          </button>
        ) : (
          <>
            <button
              type="button"
              className="saved-icon-btn"
              onClick={startEdit}
              aria-label={`Renombrar ${search.name}`}
            >
              <HugeiconsIcon icon={PencilEdit01Icon} size={15} color="currentColor" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="saved-icon-btn danger"
              onClick={() => setConfirming(true)}
              aria-label={`Borrar ${search.name}`}
            >
              <HugeiconsIcon icon={Delete02Icon} size={15} color="currentColor" strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>
    </li>
  );
}

interface SavedSearchesProps {
  searches: SavedSearch[];
  activeId: string | null;
  onLoad: (search: SavedSearch) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

function SavedSearches({ searches, activeId, onLoad, onRename, onRemove }: SavedSearchesProps) {
  // Expanded on first paint when there is something to show; collapses after a load.
  const [open, setOpen] = useState(() => searches.length > 0);

  function handleLoad(search: SavedSearch) {
    setOpen(false);
    onLoad(search);
  }

  return (
    <section className="saved-searches" aria-label="Búsquedas guardadas">
      <button
        type="button"
        className="saved-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <HugeiconsIcon icon={Bookmark01Icon} size={15} color="currentColor" strokeWidth={1.75} />
        <span className="saved-title">Búsquedas guardadas</span>
        <span className="saved-count">{searches.length}</span>
        <span className="saved-chevron">
          <HugeiconsIcon
            icon={open ? ChevronUpIcon : ChevronDownIcon}
            size={16}
            color="currentColor"
            strokeWidth={1.75}
          />
        </span>
      </button>

      {open ? (
        searches.length === 0 ? (
          <p className="saved-empty">
            Todavía no guardaste ninguna. Marcá origen y destino y tocá el botón de guardar.
          </p>
        ) : (
          <ul className="saved-list">
            {searches.map((s) => (
              <SavedSearchItem
                key={s.id}
                search={s}
                isActive={s.id === activeId}
                onLoad={handleLoad}
                onRename={onRename}
                onRemove={onRemove}
              />
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

export default SavedSearches;
