import {
  ArrowLeft,
  ChefHat,
  Edit3,
  PackageOpen,
  Plus,
  Refrigerator,
  Snowflake,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { toAppPath } from '../../app/appLocation';
import { useBackNavigation } from '../../components/navigation/useBackNavigation';
import { getLocalDateKey } from '../../theme/stillContext';
import './kitchen.css';

type KitchenLocation = 'fridge' | 'freezer' | 'pantry' | 'counter';
type KitchenFilter = 'all' | KitchenLocation;

type KitchenItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  location: KitchenLocation;
  expiresOn?: string;
  price?: number;
  createdAt: number;
  updatedAt: number;
};

type ItemDraft = {
  id?: string;
  name: string;
  quantity: string;
  unit: string;
  location: KitchenLocation;
  expiresOn: string;
  price: string;
};

const STORAGE_KEY = 'still-kitchen-inventory-v1';

const LOCATION_LABELS: Record<KitchenLocation, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  pantry: 'Pantry',
  counter: 'Counter',
};

function createItemId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `kitchen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadInventory(): KitchenItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is KitchenItem => Boolean(
      item
      && typeof item.id === 'string'
      && typeof item.name === 'string'
      && typeof item.quantity === 'number'
      && Number.isFinite(item.quantity)
      && ['fridge', 'freezer', 'pantry', 'counter'].includes(item.location),
    ));
  } catch {
    return [];
  }
}

function dateSerial(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function daysUntil(date: string | undefined, today: string) {
  if (!date) return undefined;
  const target = dateSerial(date);
  const current = dateSerial(today);
  if (target === undefined || current === undefined) return undefined;
  return target - current;
}

function expiryLabel(days: number | undefined) {
  if (days === undefined) return '';
  if (days < 0) return `${Math.abs(days)}d past date`;
  if (days === 0) return 'Use today';
  if (days === 1) return 'Use tomorrow';
  return `${days} days left`;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function recipeIdeas(items: KitchenItem[]) {
  const names = items.map((item) => normalizeName(item.name));
  const has = (...terms: string[]) => terms.some((term) => names.some((name) => name.includes(term)));
  const ideas: { title: string; note: string }[] = [];

  if (has('oat') && (has('milk') || has('yogurt'))) ideas.push({ title: 'Overnight oats', note: 'Oats plus milk or yogurt are already logged.' });
  if (has('banana') && has('flour')) ideas.push({ title: 'Banana bread', note: 'A good way to use soft bananas before they become archaeology.' });
  if (has('rice') && has('egg')) ideas.push({ title: 'Egg rice bowl', note: 'A simple pantry-and-fridge meal.' });
  if (has('rice') && has('tofu')) ideas.push({ title: 'Tofu rice bowl', note: 'Add any vegetables or sauce you already have.' });
  if ((has('pasta') || has('spaghetti')) && (has('tomato') || has('sauce'))) ideas.push({ title: 'Tomato pasta', note: 'The essentials are already in your kitchen.' });
  if (has('bread') && has('egg')) ideas.push({ title: 'Egg toast', note: 'Fast, low-effort, and uses two logged staples.' });

  return ideas.slice(0, 4);
}

function emptyDraft(location: KitchenLocation = 'fridge'): ItemDraft {
  return {
    name: '',
    quantity: '1',
    unit: 'pcs',
    location,
    expiresOn: '',
    price: '',
  };
}

export function KitchenPage() {
  const goBack = useBackNavigation('/health');
  const today = getLocalDateKey();
  const inventoryRef = useRef<HTMLElement>(null);
  const [items, setItems] = useState<KitchenItem[]>(loadInventory);
  const [filter, setFilter] = useState<KitchenFilter>('all');
  const [draft, setDraft] = useState<ItemDraft>();

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const useSoon = useMemo(() => items
    .map((item) => ({ item, days: daysUntil(item.expiresOn, today) }))
    .filter(({ days }) => days !== undefined && days <= 3)
    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999)), [items, today]);

  const filteredItems = useMemo(() => items
    .filter((item) => filter === 'all' || item.location === filter)
    .sort((a, b) => {
      const aDays = daysUntil(a.expiresOn, today) ?? 9999;
      const bDays = daysUntil(b.expiresOn, today) ?? 9999;
      return aDays - bDays || a.name.localeCompare(b.name);
    }), [filter, items, today]);

  const ideas = useMemo(() => recipeIdeas(items), [items]);
  const trackedValue = useMemo(() => items.reduce((sum, item) => sum + (item.price ?? 0), 0), [items]);

  const openAdd = (location: KitchenLocation = filter === 'all' ? 'fridge' : filter) => {
    setDraft(emptyDraft(location));
  };

  const openEdit = (item: KitchenItem) => {
    setDraft({
      id: item.id,
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
      location: item.location,
      expiresOn: item.expiresOn ?? '',
      price: item.price === undefined ? '' : String(item.price),
    });
  };

  const saveItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    const quantity = Number(draft.quantity);
    const price = draft.price.trim() ? Number(draft.price) : undefined;
    if (!name || !Number.isFinite(quantity) || quantity <= 0) return;
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) return;

    const now = Date.now();
    if (draft.id) {
      setItems((current) => current.map((item) => item.id === draft.id ? {
        ...item,
        name,
        quantity,
        unit: draft.unit.trim() || 'pcs',
        location: draft.location,
        expiresOn: draft.expiresOn || undefined,
        price,
        updatedAt: now,
      } : item));
    } else {
      setItems((current) => [{
        id: createItemId(),
        name,
        quantity,
        unit: draft.unit.trim() || 'pcs',
        location: draft.location,
        expiresOn: draft.expiresOn || undefined,
        price,
        createdAt: now,
        updatedAt: now,
      }, ...current]);
    }
    setDraft(undefined);
  };

  const removeItem = (item: KitchenItem) => {
    if (!window.confirm(`Remove “${item.name}” from your kitchen?`)) return;
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    if (draft?.id === item.id) setDraft(undefined);
  };

  const adjustQuantity = (item: KitchenItem, delta: number) => {
    const next = Math.max(0, Math.round((item.quantity + delta) * 100) / 100);
    if (next === 0) {
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      return;
    }
    setItems((current) => current.map((candidate) => candidate.id === item.id
      ? { ...candidate, quantity: next, updatedAt: Date.now() }
      : candidate));
  };

  const selectLocation = (location: KitchenLocation) => {
    setFilter(location);
    window.requestAnimationFrame(() => inventoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <main className="shell kitchen-page">
      <header className="still-page-header kitchen-header">
        <button className="btn-icon" onClick={goBack} type="button" aria-label="Back to Health"><ArrowLeft size={20} /></button>
        <div className="still-page-heading">
          <div className="still-page-heading-copy">
            <p className="section-kicker">Health · kitchen</p>
            <h1>Your real-life kitchen</h1>
            <p className="subtle">Track what is actually in the fridge, freezer, pantry, and counter before buying more food.</p>
          </div>
          <button className="btn btn-secondary btn-compact still-action-button" onClick={() => openAdd()} type="button"><Plus size={16} /> Add food</button>
        </div>
      </header>

      <section className="kitchen-summary" aria-label="Kitchen inventory summary">
        <div><strong>{items.length}</strong><span>items tracked</span></div>
        <div><strong>{useSoon.length}</strong><span>use soon</span></div>
        <div><strong>{trackedValue ? `₱${trackedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</strong><span>purchase value</span></div>
      </section>

      <section className="kitchen-room-card" aria-labelledby="kitchen-room-title">
        <div className="kitchen-room-copy">
          <p className="section-kicker">Visual kitchen</p>
          <h2 id="kitchen-room-title">Tap where the food lives</h2>
          <p>The room is a map. The inventory underneath is the boring database machinery humans apparently require.</p>
        </div>

        <div className="kitchen-location-chips" aria-label="Filter by storage location">
          <button className={filter === 'fridge' ? 'is-active' : ''} onClick={() => selectLocation('fridge')} type="button"><Refrigerator size={16} /> Fridge</button>
          <button className={filter === 'pantry' ? 'is-active' : ''} onClick={() => selectLocation('pantry')} type="button"><PackageOpen size={16} /> Pantry</button>
          <button className={filter === 'freezer' ? 'is-active' : ''} onClick={() => selectLocation('freezer')} type="button"><Snowflake size={16} /> Freezer</button>
          <button onClick={() => document.getElementById('kitchen-meals')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} type="button"><ChefHat size={16} /> Cook</button>
        </div>

        <div className="kitchen-room-stage">
          <img src={toAppPath('/assets/cozy/kitchen-inventory-room.svg')} alt="Warm isometric kitchen with a refrigerator, pantry, stove, sink, counters, and dining table" />
          <button className="kitchen-hotspot kitchen-hotspot-fridge" onClick={() => selectLocation('fridge')} type="button"><Refrigerator size={18} /><span>Fridge</span></button>
          <button className="kitchen-hotspot kitchen-hotspot-freezer" onClick={() => selectLocation('freezer')} type="button"><Snowflake size={18} /><span>Freezer</span></button>
          <button className="kitchen-hotspot kitchen-hotspot-pantry" onClick={() => selectLocation('pantry')} type="button"><PackageOpen size={18} /><span>Pantry</span></button>
          <button className="kitchen-hotspot kitchen-hotspot-cook" onClick={() => document.getElementById('kitchen-meals')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} type="button"><ChefHat size={18} /><span>Cook</span></button>
        </div>
      </section>

      {draft && <section className="card kitchen-editor" aria-labelledby="kitchen-editor-title">
        <div className="kitchen-editor-head">
          <div><p className="section-kicker">{draft.id ? 'Update food' : 'Add food'}</p><h2 id="kitchen-editor-title">{draft.id ? 'What changed?' : 'What did you bring home?'}</h2></div>
          <button onClick={() => setDraft(undefined)} type="button" aria-label="Close food editor"><X size={18} /></button>
        </div>
        <form onSubmit={saveItem}>
          <label className="kitchen-field kitchen-field-wide"><span>Food</span><input autoFocus maxLength={80} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Greek yogurt" required type="text" value={draft.name} /></label>
          <div className="kitchen-form-grid">
            <label className="kitchen-field"><span>Quantity</span><input inputMode="decimal" min="0.01" onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} required step="0.01" type="number" value={draft.quantity} /></label>
            <label className="kitchen-field"><span>Unit</span><select onChange={(event) => setDraft({ ...draft, unit: event.target.value })} value={draft.unit}><option value="pcs">pcs</option><option value="pack">pack</option><option value="bottle">bottle</option><option value="can">can</option><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option><option value="servings">servings</option></select></label>
            <label className="kitchen-field"><span>Stored in</span><select onChange={(event) => setDraft({ ...draft, location: event.target.value as KitchenLocation })} value={draft.location}><option value="fridge">Fridge</option><option value="freezer">Freezer</option><option value="pantry">Pantry</option><option value="counter">Counter</option></select></label>
            <label className="kitchen-field"><span>Use by <small>(optional)</small></span><input onChange={(event) => setDraft({ ...draft, expiresOn: event.target.value })} type="date" value={draft.expiresOn} /></label>
            <label className="kitchen-field"><span>Price paid <small>(optional)</small></span><div className="kitchen-money-input"><span>₱</span><input inputMode="decimal" min="0" onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder="0" step="0.01" type="number" value={draft.price} /></div></label>
          </div>
          <div className="kitchen-editor-actions"><button className="btn btn-secondary" onClick={() => setDraft(undefined)} type="button">Cancel</button><button className="btn btn-primary" disabled={!draft.name.trim() || Number(draft.quantity) <= 0} type="submit">{draft.id ? 'Save changes' : 'Add to kitchen'}</button></div>
        </form>
      </section>}

      <section className="kitchen-section" aria-labelledby="kitchen-soon-title">
        <div className="kitchen-section-head"><div><p className="section-kicker">Use soon</p><h2 id="kitchen-soon-title">Eat these before they betray you</h2><p>Anything with a use-by date within three days appears here.</p></div></div>
        {useSoon.length === 0 ? <div className="card kitchen-empty-small"><span>Nothing urgent right now.</span><small>Add use-by dates and Still will surface the short-lived stuff here.</small></div> : <div className="kitchen-soon-grid">
          {useSoon.slice(0, 4).map(({ item, days }) => <button className={`kitchen-soon-card ${days !== undefined && days < 0 ? 'is-overdue' : ''}`} key={item.id} onClick={() => openEdit(item)} type="button">
            <span className="kitchen-soon-icon"><UtensilsCrossed size={20} /></span>
            <strong>{item.name}</strong>
            <small>{expiryLabel(days)}</small>
          </button>)}
        </div>}
      </section>

      <section className="kitchen-section" id="kitchen-meals" aria-labelledby="kitchen-meals-title">
        <div className="kitchen-section-head"><div><p className="section-kicker">What can I make?</p><h2 id="kitchen-meals-title">Start with what you already own</h2><p>These are simple matches from the foods you logged, not a nutrition prescription.</p></div></div>
        {ideas.length === 0 ? <div className="card kitchen-empty-small"><ChefHat size={20} /><span>No obvious meal match yet.</span><small>Once you log a few staples, simple ideas will appear here.</small></div> : <div className="kitchen-idea-list">
          {ideas.map((idea) => <article className="card kitchen-idea" key={idea.title}><span><ChefHat size={18} /></span><div><strong>{idea.title}</strong><small>{idea.note}</small></div></article>)}
        </div>}
      </section>

      <section className="kitchen-section kitchen-last-section" ref={inventoryRef} aria-labelledby="kitchen-inventory-title">
        <div className="kitchen-section-head kitchen-inventory-head">
          <div><p className="section-kicker">Inventory</p><h2 id="kitchen-inventory-title">What you have left</h2><p>{filter === 'all' ? 'Everything currently logged.' : `${LOCATION_LABELS[filter]} items only.`}</p></div>
          <button className="kitchen-text-action" onClick={() => openAdd()} type="button"><Plus size={15} /> Add</button>
        </div>

        <div className="kitchen-filter-row" aria-label="Inventory filter">
          {(['all', 'fridge', 'freezer', 'pantry', 'counter'] as KitchenFilter[]).map((location) => <button className={filter === location ? 'is-active' : ''} key={location} onClick={() => setFilter(location)} type="button">{location === 'all' ? 'All' : LOCATION_LABELS[location]}</button>)}
        </div>

        {filteredItems.length === 0 ? <button className="card kitchen-empty" onClick={() => openAdd()} type="button"><Refrigerator size={24} /><span><strong>{items.length === 0 ? 'Your kitchen is empty here, not necessarily in real life.' : `Nothing logged in ${filter === 'all' ? 'this view' : LOCATION_LABELS[filter]}.`}</strong><small>Add what is actually there. No imaginary groceries, no pantry fan fiction.</small></span><Plus size={18} /></button> : <div className="card kitchen-inventory-list">
          {filteredItems.map((item) => {
            const days = daysUntil(item.expiresOn, today);
            return <article className="kitchen-item-row" key={item.id}>
              <span className={`kitchen-storage-mark kitchen-storage-${item.location}`} aria-hidden="true">{item.location === 'fridge' ? <Refrigerator size={17} /> : item.location === 'freezer' ? <Snowflake size={17} /> : <PackageOpen size={17} />}</span>
              <div className="kitchen-item-copy"><strong>{item.name}</strong><span>{LOCATION_LABELS[item.location]} · {item.quantity} {item.unit}{days !== undefined ? ` · ${expiryLabel(days)}` : ''}</span></div>
              <div className="kitchen-quantity-stepper" aria-label={`Adjust ${item.name} quantity`}><button onClick={() => adjustQuantity(item, -1)} type="button" aria-label={`Use one ${item.unit} of ${item.name}`}>−</button><span>{item.quantity}</span><button onClick={() => adjustQuantity(item, 1)} type="button" aria-label={`Add one ${item.unit} of ${item.name}`}>+</button></div>
              <div className="kitchen-row-actions"><button onClick={() => openEdit(item)} type="button" aria-label={`Edit ${item.name}`}><Edit3 size={15} /></button><button onClick={() => removeItem(item)} type="button" aria-label={`Remove ${item.name}`}><Trash2 size={15} /></button></div>
            </article>;
          })}
        </div>}
      </section>

      <p className="kitchen-local-note">Kitchen inventory is currently saved on this device. Cloud sync and receipt import can be added after the core workflow feels right.</p>
    </main>
  );
}
