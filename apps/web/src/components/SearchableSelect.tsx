import { useState, useRef, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';

interface Option {
  id: number;
  name: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
  allowCustom?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  loading = false,
  required = false,
  allowCustom = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = search
    ? options.filter((o) =>
        o.name.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (allowCustom && search.trim()) {
          onChange(search.trim());
        } else if (!search && !value) {
          setSearch('');
        } else if (value) {
          setSearch(value);
        }
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [isOpen, value, search, allowCustom, onChange]);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [search]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const items = listRef.current.children;
      if (items[highlightIndex]) {
        (items[highlightIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex, isOpen]);

  // Sync search text with external value changes
  useEffect(() => {
    setSearch(value);
  }, [value]);

  const selectOption = useCallback(
    (name: string) => {
      onChange(name);
      setSearch(name);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightIndex]) {
          selectOption(filtered[highlightIndex].name);
        } else if (allowCustom && search.trim()) {
          selectOption(search.trim());
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearch(value);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
            // Clear selection if user edits (unless custom values allowed)
            if (value && e.target.value !== value && !allowCustom) {
              onChange('');
            }
          }}
          onFocus={() => {
            setIsOpen(true);
            if (value) inputRef.current?.select();
          }}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'Loading...' : placeholder}
          disabled={disabled || loading}
          required={required}
          className={clsx(
            'input pr-8',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          autoComplete="off"
        />
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {isOpen && !disabled && !loading && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-xl bg-white shadow-lg border border-gray-200"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {search
                ? allowCustom
                  ? `Press Enter to use "${search}"`
                  : 'No matches'
                : 'No options available'}
            </div>
          ) : (
            filtered.map((option, i) => (
              <button
                key={option.id}
                type="button"
                className={clsx(
                  'w-full text-left px-3 py-2 text-sm transition-colors',
                  i === highlightIndex
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50',
                  option.name === value && 'font-medium'
                )}
                onMouseEnter={() => setHighlightIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(option.name);
                }}
              >
                {option.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
