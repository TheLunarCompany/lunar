import { Watched } from "./watched.js";

describe("Watched", () => {
  it("should update value and notify listeners on set", () => {
    const watched = new Watched(1);
    let notifiedValue: number | undefined;
    
    watched.addListener((value) => {
      notifiedValue = value;
    });

    watched.set(2);
    
    expect(watched.get()).toBe(2);
    expect(notifiedValue).toBe(2);
  });

  it("should not update or notify on equal values", () => {
    const watched = new Watched("hello");
    let notificationCount = 0;
    
    watched.addListener(() => {
      notificationCount++;
    });

    watched.set("hello");
    expect(watched.get()).toBe("hello");
    expect(notificationCount).toBe(0);

    watched.set("world");
    expect(watched.get()).toBe("world");
    expect(notificationCount).toBe(1);
  });

  it("should use custom equality function for objects", () => {
    interface Person {
      id: number;
      name: string;
    }

    const equalById = (a: Person, b: Person) => a.id === b.id;
    const watched = new Watched({ id: 1, name: "Alice" }, equalById);
    let notificationCount = 0;

    watched.addListener(() => {
      notificationCount++;
    });

    watched.set({ id: 1, name: "Bob" });
    expect(watched.get()).toEqual({ id: 1, name: "Alice" });
    expect(notificationCount).toBe(0);

    watched.set({ id: 2, name: "Charlie" });
    expect(watched.get()).toEqual({ id: 2, name: "Charlie" });
    expect(notificationCount).toBe(1);
  });
});