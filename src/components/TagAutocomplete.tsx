import React, { useState, useRef, useEffect } from 'react';

interface TagAutocompleteProps {
  availableTags: string[];
  onAdd: (tag: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function TagAutocomplete({ availableTags, onAdd, placeholder = "+ tag", className, style }: TagAutocompleteProps) {
  const [value, setValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter tags that match input
  const filteredTags = availableTags.filter(t => 
    t.toLowerCase().includes(value.toLowerCase())
  );

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = value.trim();
      if (val) {
        onAdd(val);
        setValue('');
        setShowDropdown(false);
      }
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
      <input 
        type="text"
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={e => {
          setValue(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        style={{ ...style }}
      />
      
      {showDropdown && filteredTags.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '4px',
          background: 'var(--card-bg-solid)',
          border: '1px solid var(--card-border)',
          borderRadius: '0.4rem',
          boxShadow: 'var(--shadow-default)',
          minWidth: '150px',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          padding: '0.25rem'
        }}>
          {filteredTags.map(tag => (
            <div 
              key={tag}
              onClick={() => {
                onAdd(tag);
                setValue('');
                setShowDropdown(false);
              }}
              style={{
                padding: '0.4rem 0.6rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
                borderRadius: '0.25rem',
                color: 'var(--text-primary)'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0, 122, 255, 0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {tag}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
