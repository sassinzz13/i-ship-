import { Component, input, output } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';

import { FieldError } from '../../../../shared/components/field-error/field-error';
import { Icon } from '../../../../shared/components/icon/icon';
import { PesoPipe } from '../../../../shared/pipes/peso.pipe';
import { ItemForm, itemTotals } from '../../utilities/shipment-form.utils';

/** Editable list of package items with live totals. Default change
 *  detection: it renders reactive-form state. */
@Component({
  selector: 'app-items-editor',
  imports: [ReactiveFormsModule, FieldError, Icon, PesoPipe],
  template: `
    <div class="space-y-3">
      @for (row of items().controls; track row; let i = $index) {
        <div class="rounded-lg border border-slate-200 bg-slate-50/50 p-3" [formGroup]="row">
          <div class="mb-2 flex items-center justify-between">
            <p class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Item {{ i + 1 }}</p>
            @if (items().length > 1) {
              <button type="button" class="btn-ghost !px-2 !py-1 text-xs text-rose-600" (click)="remove.emit(i)" [attr.aria-label]="'Remove item ' + (i + 1)">
                <app-icon name="trash" size="sm" /> Remove
              </button>
            }
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <div class="col-span-2 sm:col-span-3">
              <label class="form-label text-xs">Description</label>
              <input class="form-input" formControlName="description" placeholder="e.g. Documents, Shoes (box)" />
              <app-field-error [control]="row.controls.description" [server]="serverError(i, 'description')" />
            </div>
            <div>
              <label class="form-label text-xs">Qty</label>
              <input type="number" min="1" step="1" class="form-input" formControlName="quantity" />
              <app-field-error [control]="row.controls.quantity" [server]="serverError(i, 'quantity')" />
            </div>
            <div>
              <label class="form-label text-xs">Weight (kg)</label>
              <input type="number" min="0.01" step="0.01" class="form-input" formControlName="weightKg" />
              <app-field-error [control]="row.controls.weightKg" [server]="serverError(i, 'weightKg')" />
            </div>
            <div>
              <label class="form-label text-xs">Value (₱)</label>
              <input type="number" min="0" step="0.01" class="form-input" formControlName="declaredValue" />
            </div>
            <div class="col-span-2 sm:col-span-6">
              <label class="form-label text-xs">Dimensions (cm, optional)</label>
              <div class="grid grid-cols-3 gap-2">
                <input type="number" min="0" step="0.1" class="form-input" formControlName="lengthCm" placeholder="L" aria-label="Length" />
                <input type="number" min="0" step="0.1" class="form-input" formControlName="widthCm" placeholder="W" aria-label="Width" />
                <input type="number" min="0" step="0.1" class="form-input" formControlName="heightCm" placeholder="H" aria-label="Height" />
              </div>
            </div>
          </div>
        </div>
      }
      <div class="flex flex-wrap items-center justify-between gap-3">
        <button type="button" class="btn-secondary" (click)="add.emit()"><app-icon name="plus" size="sm" /> Add item</button>
        <p class="text-sm text-slate-600">
          <span class="font-medium text-slate-900">{{ totals.quantity }}</span> pcs ·
          <span class="font-medium text-slate-900">{{ totals.weight }}</span> kg ·
          declared <span class="font-medium text-slate-900">{{ totals.declaredValue | peso }}</span>
        </p>
      </div>
    </div>
  `,
})
export class ItemsEditor {
  readonly items = input.required<FormArray<ItemForm>>();
  readonly errors = input<Record<string, string>>({});
  readonly add = output<void>();
  readonly remove = output<number>();

  protected get totals() {
    return itemTotals(this.items().getRawValue());
  }

  protected serverError(i: number, field: string): string | undefined {
    const e = this.errors();
    return e[`items[${i}].${field}`] ?? e[`items.${i}.${field}`];
  }
}
