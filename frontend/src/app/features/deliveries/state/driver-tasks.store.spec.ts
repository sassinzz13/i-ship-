import { taskActions } from './driver-tasks.store';

describe('taskActions', () => {
  it('offers accept and reject only while assigned', () => {
    expect(taskActions('ASSIGNED')).toEqual({ accept: true, reject: true, start: false, deliver: false, fail: false });
  });

  it('offers start once accepted', () => {
    expect(taskActions('ACCEPTED')).toEqual({ accept: false, reject: false, start: true, deliver: false, fail: false });
  });

  it('offers deliver and fail while in progress', () => {
    expect(taskActions('IN_PROGRESS')).toEqual({ accept: false, reject: false, start: false, deliver: true, fail: true });
  });

  it('offers nothing for finished assignments', () => {
    for (const s of ['COMPLETED', 'CANCELLED', 'REJECTED'] as const) {
      expect(Object.values(taskActions(s)).some(Boolean)).toBe(false);
    }
  });
});
