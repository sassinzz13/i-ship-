import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, tap } from 'rxjs';

import { apiError } from '../../../shared/utilities/http';
import { Assignment, AssignmentStatus } from '../../assignments/models/assignment.model';
import { AssignmentService } from '../../assignments/services/assignment.service';

export interface TaskActions {
  accept: boolean;
  reject: boolean;
  start: boolean;
  deliver: boolean;
  fail: boolean;
}

/** What a driver may do with an assignment in a given status. Mirrors the
 *  backend lifecycle ASSIGNED → ACCEPTED → IN_PROGRESS → COMPLETED. */
export function taskActions(status: AssignmentStatus): TaskActions {
  return {
    accept: status === 'ASSIGNED',
    reject: status === 'ASSIGNED',
    start: status === 'ACCEPTED',
    deliver: status === 'IN_PROGRESS',
    fail: status === 'IN_PROGRESS',
  };
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

/** Driver's task list shared by the driver app pages. */
@Injectable({ providedIn: 'root' })
export class DriverTasksStore {
  private readonly api = inject(AssignmentService);

  readonly active = signal<Assignment[]>([]);
  readonly history = signal<Assignment[] | null>(null);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);
  /** Assignment id with an action in flight. */
  readonly busyId = signal<number | null>(null);

  readonly summary = computed(() => {
    const a = this.active();
    return {
      toAccept: a.filter((x) => x.status === 'ASSIGNED').length,
      ready: a.filter((x) => x.status === 'ACCEPTED').length,
      inProgress: a.filter((x) => x.status === 'IN_PROGRESS').length,
      completedToday: (this.history() ?? []).filter((x) => x.status === 'COMPLETED' && isToday(x.completedAt)).length,
    };
  });

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .mine('active')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (items) => {
          this.active.set(this.sort(items));
          this.loaded.set(true);
        },
        error: (err) => this.error.set(apiError(err).message),
      });
  }

  loadHistory(): void {
    this.api.mine('history').subscribe({
      next: (items) => this.history.set(items),
      error: () => this.history.set(this.history() ?? []),
    });
  }

  find(id: number): Assignment | undefined {
    return this.active().find((a) => a.id === id) ?? this.history()?.find((a) => a.id === id);
  }

  /** Fetches one assignment, refreshing the cached copy. */
  fetch(id: number): Observable<Assignment> {
    return this.api.get(id).pipe(tap((a) => this.upsert(a)));
  }

  accept(id: number): Observable<Assignment> {
    return this.run(id, this.api.accept(id));
  }

  reject(id: number, reason: string): Observable<Assignment> {
    return this.run(id, this.api.reject(id, reason)).pipe(tap(() => this.remove(id)));
  }

  start(id: number): Observable<Assignment> {
    return this.run(id, this.api.start(id));
  }

  /** Called after a delivery outcome is recorded; the assignment is done. */
  complete(id: number): void {
    this.remove(id);
    this.history.set(null);
  }

  private run(id: number, req: Observable<Assignment>): Observable<Assignment> {
    this.busyId.set(id);
    return req.pipe(
      tap((a) => this.upsert(a)),
      finalize(() => this.busyId.set(null)),
    );
  }

  private upsert(a: Assignment): void {
    const active = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(a.status);
    const rest = this.active().filter((x) => x.id !== a.id);
    this.active.set(active ? this.sort([...rest, a]) : rest);
  }

  private remove(id: number): void {
    this.active.set(this.active().filter((x) => x.id !== id));
  }

  /** In-progress first, then ready to start, then awaiting acceptance. */
  private sort(items: Assignment[]): Assignment[] {
    const rank: Record<string, number> = { IN_PROGRESS: 0, ACCEPTED: 1, ASSIGNED: 2 };
    return [...items].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.assignedAt.localeCompare(b.assignedAt));
  }
}
