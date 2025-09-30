// A simple class to watch a value and notify listeners when it changes.
// A custom `equalFn` can be provided to determine if the new value is different from the current one.
export class Watched<T> {
  private value: T;
  private equalFn: EqualFn<T>;
  private listeners: Array<(value: T) => void> = [];

  constructor(initialValue: T, equalFn?: (a: T, b: T) => boolean) {
    this.value = initialValue;
    this.equalFn = equalFn || ((a, b) => a === b);
  }

  get(): T {
    return this.value;
  }

  set(newValue: T): void {
    if (this.equalFn(this.value, newValue)) {
      return;
    }
    this.value = newValue;
    this.notifyListeners();
  }

  addListener(listener: (value: T) => void): void {
    this.listeners.push(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.value);
    }
  }
}

type EqualFn<T> = (a: T, b: T) => boolean;
