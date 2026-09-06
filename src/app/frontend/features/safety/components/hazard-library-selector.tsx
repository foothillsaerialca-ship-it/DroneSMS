/**
 * File purpose: Provides searchable selection of reusable hazard-library records.
 * Fallback/error behavior: Empty or unavailable hazard collections render an empty selector state.
 * Known limitation: Selection does not itself persist a hazard until the owning form submits it.
 */
import { useMemo, useState } from 'react';
import { type HazardLibraryRecord, searchHazardLibrary } from '../lib/hazard-library';

type HazardLibrarySelectorProps = {
  hazards: HazardLibraryRecord[];
  value: string;
  onChange: (hazardId: string) => void;
  disabled?: boolean;
};

export function HazardLibrarySelector({ hazards, value, onChange, disabled = false }: HazardLibrarySelectorProps) {
  const selected = hazards.find((hazard) => hazard.id === value);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const results = useMemo(() => searchHazardLibrary(hazards, query), [hazards, query]);

  function select(hazard: HazardLibraryRecord) {
    onChange(hazard.id);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative">
      <label htmlFor="hazard-library-search" className="block text-sm font-medium text-slate-700">Existing Hazard</label>
      <input
        id="hazard-library-search"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="hazard-library-results"
        aria-expanded={open}
        autoComplete="off"
        disabled={disabled}
        placeholder="Search hazard name, category, mitigation, or service type"
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"
        value={open ? query : selected?.hazard_name || ''}
        onFocus={() => { setQuery(''); setOpen(true); }}
        onChange={(event) => { setQuery(event.target.value); onChange(''); setOpen(true); }}
        onBlur={() => setOpen(false)}
      />
      {open ? <ul id="hazard-library-results" role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
        {results.length ? results.map((hazard) => <li key={hazard.id} role="option" aria-selected={hazard.id === value}>
          <button type="button" className="w-full px-3 py-2 text-left hover:bg-brand-50 focus:bg-brand-50" onMouseDown={(event) => event.preventDefault()} onClick={() => select(hazard)}>
            <span className="block font-semibold text-slate-900">{hazard.hazard_name}</span>
            <span className="block text-sm text-slate-500">{hazard.category}</span>
          </button>
        </li>) : <li className="px-3 py-3 text-sm text-slate-500">No Hazard Library records match this search.</li>}
      </ul> : null}
    </div>
  );
}
