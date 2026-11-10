/** Store de toasts minimal (pub/sub, sans contexte React). `toast.error(...)`
 *  depuis n'importe où ; <Toaster/> s'y abonne. */
export type ToastKind = 'error' | 'success' | 'info';
export interface ToastItem { id: number; kind: ToastKind; message: string; title?: string }

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<(items: ToastItem[]) => void>();
function emit() { for (const l of listeners) l(items); }

export function subscribeToasts(l: (items: ToastItem[]) => void): () => void {
  listeners.add(l); l(items);
  return () => { listeners.delete(l); };
}
export function dismissToast(id: number): void {
  items = items.filter((t) => t.id !== id); emit();
}
export function pushToast(kind: ToastKind, message: string, title?: string): number {
  const id = ++seq;
  items = [...items, { id, kind, message, title }];
  emit();
  setTimeout(() => dismissToast(id), kind === 'error' ? 9000 : 4000);
  return id;
}
export const toast = {
  error: (message: string, title?: string) => pushToast('error', message, title),
  success: (message: string, title?: string) => pushToast('success', message, title),
  info: (message: string, title?: string) => pushToast('info', message, title),
};
