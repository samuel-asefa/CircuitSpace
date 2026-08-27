import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CATALOG, CATALOG_BY_ID } from '../catalog';
import { useSessionStore } from '../state/sessionStore';
import type { ComponentCategory } from '../types';
import { 
  Search, Star, Zap, Cpu, Radio, Activity, 
  Package, Plug, ChevronRight, ChevronDown, Plus
} from 'lucide-react';

const CATEGORY_ICONS: Record<ComponentCategory, React.ReactNode> = {
  Power: <Zap size={14} />,
  Compute: <Cpu size={14} />,
  Sensors: <Activity size={14} />,
  Communications: <Radio size={14} />,
  Actuation: <Package size={14} />,
  Connectivity: <Plug size={14} />,
  Passives: <span style={{ fontSize: 11, fontWeight: 700 }}>Ω</span>,
};

const CATEGORIES: ComponentCategory[] = [
  'Power', 'Compute', 'Sensors', 'Communications', 'Actuation', 'Connectivity', 'Passives'
];

const RECENT_STORAGE_KEY = 'cs_recent_components';
const FAV_STORAGE_KEY = 'cs_fav_components';

function useLocalList(key: string): [string[], (id: string) => void, (id: string) => void] {
  const [list, setList] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
  });
  const add = (id: string) => setList(prev => {
    const next = [id, ...prev.filter(x => x !== id)].slice(0, 20);
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  });
  const remove = (id: string) => setList(prev => {
    const next = prev.filter(x => x !== id);
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  });
  return [list, add, remove];
}

export const ComponentLibrary: React.FC = () => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ComponentCategory | 'All' | 'Recent' | 'Favorites'>('All');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const [recentIds, addRecent] = useLocalList(RECENT_STORAGE_KEY);
  const [favIds, addFav, removeFav] = useLocalList(FAV_STORAGE_KEY);

  const { setMode, mode, placingDefId } = useSessionStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filteredComponents = useMemo(() => {
    let items = CATALOG;
    if (selectedCategory === 'Recent') {
      items = recentIds.map(id => CATALOG_BY_ID[id]).filter(Boolean) as typeof CATALOG;
    } else if (selectedCategory === 'Favorites') {
      items = favIds.map(id => CATALOG_BY_ID[id]).filter(Boolean) as typeof CATALOG;
    } else if (selectedCategory !== 'All') {
      items = items.filter(c => c.category === selectedCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return items;
  }, [query, selectedCategory, recentIds, favIds]);

  const groupedByCategory = useMemo(() => {
    if (query.trim() || selectedCategory !== 'All') {
      return new Map<string, typeof CATALOG>([['Results', filteredComponents]]);
    }
    const map = new Map<string, typeof CATALOG>();
    for (const cat of CATEGORIES) {
      const items = CATALOG.filter(c => c.category === cat);
      if (items.length) map.set(cat, items);
    }
    return map;
  }, [filteredComponents, query, selectedCategory]);

  const handlePlace = (defId: string) => {
    addRecent(defId);
    setMode('place', defId);
  };

  const toggleFav = (defId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (favIds.includes(defId)) removeFav(defId);
    else addFav(defId);
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const renderComponent = (comp: (typeof CATALOG)[number]) => {
    const isPlacing = mode === 'place' && placingDefId === comp.id;
    const isFav = favIds.includes(comp.id);
    return (
      <div
        key={comp.id}
        onClick={() => handlePlace(comp.id)}
        style={{
          padding: '6px 12px',
          cursor: 'pointer',
          background: isPlacing ? 'rgba(0,163,255,0.12)' : 'transparent',
          borderLeft: isPlacing ? '2px solid var(--cs-accent)' : '2px solid transparent',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          userSelect: 'none',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = isPlacing ? 'rgba(0,163,255,0.12)' : 'var(--bg-surface)')}
        onMouseLeave={e => (e.currentTarget.style.background = isPlacing ? 'rgba(0,163,255,0.12)' : 'transparent')}
      >
        <span style={{ color: 'var(--text-tertiary)', fontSize: 10, minWidth: 24 }}>{comp.refPrefix}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {comp.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {comp.description.slice(0, 60)}{comp.description.length > 60 ? '…' : ''}
          </div>
        </div>
        <button
          onClick={(e) => toggleFav(comp.id, e)}
          style={{
            background: 'none', border: 'none', padding: 2, cursor: 'pointer',
            color: isFav ? 'var(--status-warning)' : 'var(--text-tertiary)',
            flexShrink: 0,
          }}
          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={12} fill={isFav ? 'currentColor' : 'none'} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handlePlace(comp.id); }}
          style={{
            background: 'none', border: 'none', padding: 2, cursor: 'pointer',
            color: 'var(--text-tertiary)', flexShrink: 0,
          }}
          title={`Place ${comp.name}`}
        >
          <Plus size={12} />
        </button>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Search */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-divider)' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search components… (⌘K)"
            style={{ width: '100%', paddingLeft: 28, paddingRight: 8, height: 28 }}
          />
        </div>
      </div>

      {/* Category filter tabs */}
      <div style={{
        display: 'flex', overflowX: 'auto', gap: 1, padding: '4px 8px',
        borderBottom: '1px solid var(--border-divider)', flexShrink: 0,
      }}>
        {(['All', 'Recent', 'Favorites', ...CATEGORIES] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat as any)}
            style={{
              fontSize: 10, padding: '2px 8px', border: 'none', borderRadius: 3, cursor: 'pointer',
              background: selectedCategory === cat ? 'var(--cs-accent)' : 'transparent',
              color: selectedCategory === cat ? '#000' : 'var(--text-secondary)',
              whiteSpace: 'nowrap', fontWeight: selectedCategory === cat ? 600 : 400,
            }}
          >
            {cat === 'Recent' ? '⏱' : cat === 'Favorites' ? '★' : cat}
          </button>
        ))}
      </div>

      {/* Component list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {Array.from(groupedByCategory.entries()).map(([cat, items]) => (
          <div key={cat}>
            {groupedByCategory.size > 1 && (
              <div
                onClick={() => toggleCategory(cat)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                  background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-divider)',
                  cursor: 'pointer', userSelect: 'none',
                }}
              >
                {CATEGORY_ICONS[cat as ComponentCategory] ?? null}
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {cat}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{items.length}</span>
                {collapsedCategories.has(cat) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </div>
            )}
            {!collapsedCategories.has(cat) && items.map(c => renderComponent(c))}
          </div>
        ))}
        {filteredComponents.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
            No components match "{query}"
          </div>
        )}
      </div>

      {/* Status */}
      {mode === 'place' && placingDefId && (
        <div style={{
          padding: '6px 12px', background: 'rgba(0,163,255,0.12)',
          borderTop: '1px solid var(--cs-accent)', fontSize: 11, color: 'var(--cs-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Click canvas to place {CATALOG_BY_ID[placingDefId]?.name}</span>
          <button onClick={() => setMode('select')} style={{ fontSize: 10, color: 'var(--cs-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Cancel (Esc)
          </button>
        </div>
      )}
    </div>
  );
};
