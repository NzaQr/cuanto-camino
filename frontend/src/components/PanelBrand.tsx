import React from 'react';
import './PanelBrand.css';

interface PanelBrandProps {
  /** Render the title as an h2. Off inside a button, where a heading is not valid. */
  heading?: boolean;
  /** Id for the title, so a dialog can point `aria-labelledby` at it. */
  titleId?: string;
}

/** App icon, title and subtitle. Shared by the desktop card header and the mobile sheet. */
function PanelBrand({ heading = false, titleId }: PanelBrandProps) {
  const Title = heading ? 'h2' : 'span';
  return (
    <>
      <span className="panel-icon">
        <img className="panel-icon-image" src="/brand-icon.png" alt="" />
      </span>
      <span className="panel-brand-text">
        <Title className="panel-title" id={titleId}>
          Cuánto Camino
        </Title>
        <span className="panel-subtitle">Encontrá tu línea</span>
      </span>
    </>
  );
}

export default PanelBrand;
