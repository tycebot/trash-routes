import { useState } from 'react';

export function InstallHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="install-help">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Install on iPad
      </button>
      {open && (
        <div className="install-help-overlay" onPointerDown={() => setOpen(false)}>
          <section
            className="install-help-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-help-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="install-help-header">
              <h2 id="install-help-title">Add Route Review to the Home Screen</h2>
              <button
                type="button"
                className="install-help-close"
                aria-label="Close install instructions"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <ol>
              <li>Open the GitHub Pages link in Safari over HTTPS.</li>
              <li>Tap Safari’s Share button.</li>
              <li>Choose <b>Add to Home Screen</b>, then tap Add.</li>
            </ol>
            <p className="muted">The installed app keeps route edits on this iPad. Map tiles require an internet connection.</p>
          </section>
        </div>
      )}
    </div>
  );
}
