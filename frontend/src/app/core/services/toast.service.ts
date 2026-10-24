import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  success(message: string): void {
    this.push('success', message);
  }

  error(message: string): void {
    this.push('error', message, 6000);
  }

  info(message: string): void {
    this.push('info', message);
  }

  dismiss(id: number): void {
    this.toasts.update((ts) => ts.filter((t) => t.id !== id));
  }

  private push(kind: ToastKind, message: string, ttl = 3500): void {
    // Collapse identical messages fired in quick succession.
    if (this.toasts().some((t) => t.message === message)) return;
    const id = this.nextId++;
    this.toasts.update((ts) => [...ts.slice(-3), { id, kind, message }]);
    setTimeout(() => this.dismiss(id), ttl);
  }
}
