// Shared inspector field kinds: text | number | select | check. One schema per paradigm,
// one adaptive inspector shell.
export type FieldKind = 'text' | 'number' | 'select' | 'check';
export interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  half?: true;
  ph?: string;
  min?: number;
  max?: number;
  step?: number;
}
type FieldOpts = Partial<Pick<Field, 'half' | 'ph' | 'min' | 'max' | 'step'>>;
export const F = (key: string, label: string, kind?: FieldKind, o?: FieldOpts): Field => ({ key, label, kind: kind ?? 'text', ...(o ?? {}) });
export const NAME: Field = F('name', 'name');
