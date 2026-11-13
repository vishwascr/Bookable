import { useState, useEffect, useRef } from 'react';
import { api, getToken } from '../api.js';

const STATUS_CONFIG = {
  none: { label: '+ Want to Read', icon: null },
  want_to_read: { label: '✓ Want to Read', icon: '✓' },
  currently_reading: { label: '📖 Currently Reading', icon: '📖' },
  read: { label: '✓ Read', icon: '✓' },
};

export default function ReadingStatusButton({
  isbn,
  book = null,
  status = null,
  me = null,
  onStatusChange = null,
  onRequireAuth = null,
  size = 'md',
  className = '',
}) {
  const targetIsbn = isbn || book?.isbn || '';
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  // Compute effective status from prop or me state
  const computeStatus = () => {
    if (status && status !== 'none') return status;
    if (me?.user && targetIsbn) {
      if (me.user.wantToRead?.includes(targetIsbn)) return 'want_to_read';
      if (me.user.currentlyReading?.includes(targetIsbn)) return 'currently_reading';
      if (me.user.read?.includes(targetIsbn)) return 'read';
    }
    return status || 'none';
  };

  const [localStatus, setLocalStatus] = useState(computeStatus);

  useEffect(() => {
    setLocalStatus(computeStatus());
  }, [status, me, targetIsbn]);

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const executeStatusChange = async (newStatus) => {
    if (!getToken()) {
      setIsOpen(false);
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }

    if (!targetIsbn) return;

    const prev = localStatus;
    setLocalStatus(newStatus);
    setLoading(true);
    setIsOpen(false);

    try {
      if (onStatusChange) {
        await onStatusChange(targetIsbn, newStatus, book);
      } else {
        await api.updateShelfStatus(targetIsbn, newStatus);
      }
    } catch (err) {
      setLocalStatus(prev);
      console.error('Failed to update shelf status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handle1Click = (e) => {
    e.stopPropagation();
    executeStatusChange('want_to_read');
  };

  const handleToggleDropdown = (e) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handleSelectOption = (e, targetStatus) => {
    e.stopPropagation();
    if (targetStatus === localStatus) {
      setIsOpen(false);
      return;
    }
    executeStatusChange(targetStatus);
  };

  const isShelved = localStatus && localStatus !== 'none';

  return (
    <div
      className={`reading-status-container ${size} ${className}`}
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
    >
      {!isShelved ? (
        <div className="status-btn-group">
          <button
            type="button"
            className="status-btn status-btn-main status-none"
            onClick={handle1Click}
            disabled={loading}
            title="Add to Want to Read"
          >
            {loading ? 'Adding…' : '+ Want to Read'}
          </button>
          <button
            type="button"
            className="status-btn status-btn-dropdown-trigger"
            onClick={handleToggleDropdown}
            disabled={loading}
            title="Choose reading status"
            aria-expanded={isOpen}
          >
            ▾
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`status-btn status-btn-active status-${localStatus}`}
          onClick={handleToggleDropdown}
          disabled={loading}
          title="Change reading shelf"
          aria-expanded={isOpen}
        >
          <span className="status-label">
            {STATUS_CONFIG[localStatus]?.label || 'Shelved'}
          </span>
          <span className="dropdown-arrow">▾</span>
        </button>
      )}

      {isOpen && (
        <ul className="reading-status-menu" role="menu">
          <li
            role="menuitem"
            className={`status-menu-item ${localStatus === 'want_to_read' ? 'selected' : ''}`}
            onClick={(e) => handleSelectOption(e, 'want_to_read')}
          >
            <span className="status-item-icon">{localStatus === 'want_to_read' ? '✓' : ''}</span>
            <span className="status-item-text">Want to read</span>
          </li>
          <li
            role="menuitem"
            className={`status-menu-item ${localStatus === 'currently_reading' ? 'selected' : ''}`}
            onClick={(e) => handleSelectOption(e, 'currently_reading')}
          >
            <span className="status-item-icon">{localStatus === 'currently_reading' ? '✓' : ''}</span>
            <span className="status-item-text">Currently reading</span>
          </li>
          <li
            role="menuitem"
            className={`status-menu-item ${localStatus === 'read' ? 'selected' : ''}`}
            onClick={(e) => handleSelectOption(e, 'read')}
          >
            <span className="status-item-icon">{localStatus === 'read' ? '✓' : ''}</span>
            <span className="status-item-text">Read</span>
          </li>
          {isShelved && (
            <>
              <li className="status-menu-divider" role="separator" />
              <li
                role="menuitem"
                className="status-menu-item status-menu-item-remove"
                onClick={(e) => handleSelectOption(e, 'none')}
              >
                <span className="status-item-icon">✕</span>
                <span className="status-item-text">Remove from shelf</span>
              </li>
            </>
          )}
        </ul>
      )}
    </div>
  );
}
