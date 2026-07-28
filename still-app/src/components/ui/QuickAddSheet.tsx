import { BookOpen, CalendarPlus, CheckSquare, HeartPulse, ReceiptText, Timer, X } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

const actions = [
  ['Task', CheckSquare], ['Event', CalendarPlus], ['Expense', ReceiptText],
  ['Work', Timer], ['Check-in', HeartPulse], ['Journal', BookOpen],
];

export function QuickAddSheet() {
  const open = useAppStore((s) => s.quickAddOpen);
  const close = useAppStore((s) => s.closeQuickAdd);
  if (!open) return null;
  return <div className="sheet-backdrop" onClick={close}>
    <section className="sheet" onClick={(e) => e.stopPropagation()} aria-modal="true" role="dialog">
      <div className="sheet-handle" />
      <div className="section-head">
        <div><h2 className="section-title">Add something</h2><p className="subtle">What would you like to remember?</p></div>
        <button className="link-btn" onClick={close} aria-label="Close"><X /></button>
      </div>
      <div className="quick-grid">
        {actions.map(([label, Icon]) => <button className="quick-action" key={label as string} onClick={() => alert(`${label} form comes next.`)}>
          <Icon size={24} /><div>{label as string}</div>
        </button>)}
      </div>
    </section>
  </div>;
}
