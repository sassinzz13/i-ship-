import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

/**
 * Shows the first validation message for a control once it is touched, or a
 * server-side message for the field when one is provided. Uses default
 * change detection because form control state is not signal-based.
 */
@Component({
  selector: 'app-field-error',
  template: `@if (message; as m) { <p class="form-error">{{ m }}</p> }`,
})
export class FieldError {
  readonly control = input<AbstractControl | null>(null);
  readonly server = input<string | null | undefined>(null);

  protected get message(): string | null {
    const srv = this.server();
    if (srv) return srv.charAt(0).toUpperCase() + srv.slice(1);
    const c = this.control();
    if (!c || !c.errors || !(c.touched || c.dirty)) return null;
    const e = c.errors;
    if (e['required']) return 'This field is required';
    if (e['email']) return 'Enter a valid email address';
    if (e['minlength']) return `Must be at least ${e['minlength'].requiredLength} characters`;
    if (e['maxlength']) return `Must be at most ${e['maxlength'].requiredLength} characters`;
    if (e['min']) return `Must be at least ${e['min'].min}`;
    if (e['max']) return `Must be at most ${e['max'].max}`;
    if (e['pattern']) return 'Invalid format';
    return 'Invalid value';
  }
}
