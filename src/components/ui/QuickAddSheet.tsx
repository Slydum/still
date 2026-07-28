import {
  BookOpen,
  CalendarPlus,
  CheckSquare,
  HeartPulse,
  ReceiptText,
  Timer,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

const actions: Array<[label: string, icon: LucideIcon]> = [
  ['Task', CheckSquare],
  ['Event', CalendarPlus],
  ['Expense', ReceiptText],
  ['Work', Timer],
  ['Check-in', HeartPulse],
  ['Journal', BookOpen],
];

export function QuickAddSheet() {
  const open = useAppStore((state) => state.quickAddOpen);
  const close = useAppStore((state) => state.closeQuickAdd);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={close}>
      <section
        className="sheet"
        onClick={(event) => event.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby="quick-add-title"
      >
        <div className="sheet-handle" />
        <div className="section-head">
          <div>
            <h2 className="section-title" id="quick-add-title">Add something</h2>
            <p className="subtle">What would you like to remember?</p>
          </div>
          <button className="link-btn" onClick={close} aria-label="Close" type="button">
            <X />
          </button>
        </div>
        <div className="quick-grid">
          {actions.map(([label, Icon]) => (
            <button
              className="quick-action"
              key={label}
              onClick={() => window.alert(`${label} form comes next.`)}
              type="button"
            >
              <Icon size={24} />
              <div>{label}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
