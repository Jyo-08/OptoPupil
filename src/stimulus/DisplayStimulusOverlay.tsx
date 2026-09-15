import React from 'react';

interface DisplayStimulusOverlayProps {
  /** Whether the bright display stimulus is currently active */
  isActive: boolean;
}

/**
 * DisplayStimulusOverlay
 * Full-screen optical light stimulus rendered via the device display.
 * 
 * Renders pure bright white (#FFFFFF) with zero CSS transitions
 * to provide an instantaneous, controlled light pulse for pupillary reflex elicitation.
 */
export const DisplayStimulusOverlay: React.FC<DisplayStimulusOverlayProps> = ({ isActive }) => {
  if (!isActive) {
    return null;
  }

  return (
    <div
      id="display-stimulus-overlay"
      role="presentation"
      aria-hidden="true"
      className="fixed inset-0 z-[99999] bg-white pointer-events-none"
      style={{
        backgroundColor: '#ffffff',
        transition: 'none',
      }}
    />
  );
};
