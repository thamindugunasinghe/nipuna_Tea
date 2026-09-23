'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, User } from 'lucide-react';

interface Customer {
  id: number;
  customerId: string;
  name: string;
  phone?: string | null;
  type?: string;
}

interface CustomerSearchProps {
  customers: Customer[];
  selectedId: string;
  onSelect: (customerId: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
}

export default function CustomerSearch({
  customers,
  selectedId,
  onSelect,
  label,
  required = false,
  placeholder = 'Search by name or ID...',
}: CustomerSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedCustomer = customers.find(c => String(c.id) === selectedId);

  // Filter customers by query (name or customerId)
  const filtered = query.trim()
    ? customers.filter(c => {
        const q = query.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.customerId && c.customerId.toLowerCase().includes(q))
        );
      }).slice(0, 20)
    : customers.slice(0, 20);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('li');
      if (items[highlightIndex]) {
        items[highlightIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex]);

  const handleSelect = (customer: Customer) => {
    onSelect(String(customer.id));
    setQuery('');
    setIsOpen(false);
    setHighlightIndex(-1);
  };

  const handleClear = () => {
    onSelect('');
    setQuery('');
    setIsOpen(false);
    setHighlightIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && filtered[highlightIndex]) {
          handleSelect(filtered[highlightIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightIndex(-1);
        break;
    }
  };

  return (
    <div className="customer-search-wrapper" ref={wrapperRef}>
      {label && (
        <label className="form-label">
          {label} {required && '*'}
        </label>
      )}

      {selectedCustomer ? (
        <div className="customer-search-selected">
          <div className="customer-search-selected-info">
            <User size={16} />
            <span className="customer-search-selected-id">{selectedCustomer.customerId}</span>
            <span className="customer-search-selected-name">{selectedCustomer.name}</span>
          </div>
          <button
            type="button"
            className="customer-search-clear"
            onClick={handleClear}
            title="Clear selection"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="customer-search-input-wrapper">
          <Search size={16} className="customer-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="form-input customer-search-input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setHighlightIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
          />
        </div>
      )}

      {isOpen && !selectedCustomer && (
        <ul className="customer-search-dropdown" ref={listRef}>
          {filtered.length === 0 ? (
            <li className="customer-search-empty">
              No customers found
            </li>
          ) : (
            filtered.map((c, i) => (
              <li
                key={c.id}
                className={`customer-search-item ${i === highlightIndex ? 'highlighted' : ''}`}
                onClick={() => handleSelect(c)}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                <span className="customer-search-item-id">{c.customerId}</span>
                <span className="customer-search-item-name">{c.name}</span>
                {c.type === 'non-regular' && (
                  <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', marginLeft: 'auto', flexShrink: 0 }}>Non-Regular</span>
                )}
              </li>
            ))
          )}
          {customers.length > 20 && query.trim() === '' && (
            <li className="customer-search-hint">
              Type to search {customers.length} customers...
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
