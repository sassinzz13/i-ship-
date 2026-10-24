import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, output, signal, viewChild } from '@angular/core';

/** Canvas signature capture for touch and mouse. Emits a PNG blob (or null
 *  when cleared) every time a stroke ends. */
@Component({
  selector: 'app-signature-pad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white">
      <canvas #canvas class="block h-48 w-full touch-none" (pointerdown)="start($event)" (pointermove)="move($event)"
        (pointerup)="end()" (pointerleave)="end()" (pointercancel)="end()"></canvas>
      @if (empty()) {
        <p class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">Sign here</p>
      }
      <button type="button" class="btn-ghost absolute top-2 right-2 !px-2 !py-1 text-xs" (click)="clear()">Clear</button>
    </div>
  `,
})
export class SignaturePad implements AfterViewInit {
  readonly changed = output<Blob | null>();
  protected readonly empty = signal(true);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private ctx!: CanvasRenderingContext2D;
  private drawing = false;

  ngAfterViewInit(): void {
    const c = this.canvas().nativeElement;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    this.ctx = c.getContext('2d')!;
    this.ctx.scale(ratio, ratio);
    this.ctx.lineWidth = 2.2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = '#0f172a';
  }

  protected start(e: PointerEvent): void {
    this.drawing = true;
    this.canvas().nativeElement.setPointerCapture(e.pointerId);
    const p = this.point(e);
    this.ctx.beginPath();
    this.ctx.moveTo(p.x, p.y);
  }

  protected move(e: PointerEvent): void {
    if (!this.drawing) return;
    const p = this.point(e);
    this.ctx.lineTo(p.x, p.y);
    this.ctx.stroke();
    this.empty.set(false);
  }

  protected end(): void {
    if (!this.drawing) return;
    this.drawing = false;
    if (!this.empty()) this.canvas().nativeElement.toBlob((b) => this.changed.emit(b), 'image/png');
  }

  clear(): void {
    const c = this.canvas().nativeElement;
    this.ctx.clearRect(0, 0, c.width, c.height);
    this.empty.set(true);
    this.changed.emit(null);
  }

  private point(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas().nativeElement.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
}
