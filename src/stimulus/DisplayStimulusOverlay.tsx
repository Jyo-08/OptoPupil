import React from 'react';
import { createPortal } from 'react-dom';

interface DisplayStimulusOverlayProps {
  /** Whether the bright display stimulus is currently active */
  isActive: boolean;
}

/**
 * DisplayStimulusOverlay
 * Full-screen optical light stimulus rendered via the device display.
 * 
 * Renders pure bright white (#FFFFFF) via a React Portal directly to document.body
 * with zero CSS transitions and maximum z-index (2147483647) to guarantee instantaneous,
 * unclipped full-display illumination for pupillary light reflex elicitation.
 */
export const DisplayStimulusOverlay: React.FC<DisplayStimulusOverlayProps> = ({ isActive }) => {
  if (!isActive || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      id="display-stimulus-overlay"
      role="presentation"
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#ffffff',
        zIndex: 2147483647,
        pointerEvents: 'none',
        margin: 0,
        padding: 0,
        boxSizing: 'border-box',
        transition: 'none',
      }}
    />,
    document.body
  );
};
