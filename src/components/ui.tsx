import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { PALETTE } from '../data/defaults';

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <div className="text-sm text-ink2">{label}</div>
      <div className={`mt-1 truncate text-xl font-semibold sm:text-2xl ${tone === 'bad' ? 'text-bad' : ''}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' };
export function Button({ variant = 'ghost', className = '', ...p }: BtnProps) {
  const styles = {
    primary: 'bg-accent text-accent-ink hover:opacity-90',
    ghost: 'border border-line bg-surface hover:bg-sunken',
    danger: 'border border-line bg-surface text-bad hover:bg-sunken',
  }[variant];
  return <button type="button" className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${styles} ${className}`} {...p} />;
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="text-ink2">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full rounded-lg border border-line bg-plane px-2.5 py-1.5 text-ink outline-none focus:border-accent';

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputCls} {...p} />;
}

/** Champ numérique qui accepte la virgule et laisse l'utilisateur taper librement. */
export function NumberInput({ value, onChange, step, ...p }: { value: number; onChange: (n: number) => void; step?: number } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text.replace(',', '.')) !== value) setText(String(value));
  }, [value]);
  return (
    <input
      className={`${inputCls} tnum`}
      inputMode="decimal"
      step={step}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value.replace(/\s/g, '').replace(',', '.'));
        if (e.target.value.trim() !== '' && !Number.isNaN(n)) onChange(n);
      }}
      onBlur={() => setText(String(value))}
      {...p}
    />
  );
}

export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={inputCls} {...p} />;
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-label={title} className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-t-2xl border border-line bg-surface p-5 sm:rounded-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" aria-label="Fermer" className="rounded-md px-2 text-xl text-muted hover:bg-sunken" onClick={onClose}>×</button>
        </div>
        {children}
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function useIsDark(): boolean {
  const q = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined;
  const [dark, setDark] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return;
    const f = () => setDark(q.matches);
    q.addEventListener('change', f);
    return () => q.removeEventListener('change', f);
  }, [q]);
  return dark;
}

export function useChartTheme() {
  const dark = useIsDark();
  return {
    series: dark ? PALETTE.dark : PALETTE.light,
    ink: dark ? '#ffffff' : '#0b0b0b',
    ink2: dark ? '#c3c2b7' : '#52514e',
    muted: '#898781',
    grid: dark ? '#2c2c2a' : '#e1e0d9',
    axis: dark ? '#383835' : '#c3c2b7',
    surface: dark ? '#1a1a19' : '#fcfcfb',
  };
}

export function Swatch({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />;
}
