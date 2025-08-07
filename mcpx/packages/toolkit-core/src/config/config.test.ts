import { noOpLogger } from "../logging";
import { ManualClock } from "../time";
import { ConfigManager } from "./manager";

interface FoodItem {
  name: "banana" | "apple" | "pizza";
  count: number;
  caloriesPerItem: number;
}
interface Config {
  dailyFoods: FoodItem[];
  dailyAllowedCalories: number;
}
describe("ConfigManager", () => {
  const initialConfig: Config = {
    dailyFoods: [
      // 900 calories
      { name: "apple", count: 3, caloriesPerItem: 100 },
      { name: "banana", count: 2, caloriesPerItem: 150 },
      { name: "pizza", count: 1, caloriesPerItem: 300 },
    ],
    dailyAllowedCalories: 2000,
  };
  describe("config access", () => {
    describe("initial config", () => {
      const clock = new ManualClock();
      const manager = new ConfigManager<Config>(initialConfig, noOpLogger, {
        clock,
      });
      it("is accessible", () => {
        expect(manager.currentConfig).toEqual(initialConfig);
        expect(manager.currentVersion).toBe(0);
        expect(manager.lastModified).toEqual(clock.now());
      });
    });

    describe("config update", () => {
      const clock = new ManualClock();
      const manager = new ConfigManager<Config>(initialConfig, noOpLogger, {
        clock,
      });

      clock.advanceBy(6 * 1000); // Simulate 6 seconds passing
      // No more pizza!
      const updatedConfig: Config = {
        dailyFoods: [
          // 650 calories
          { name: "apple", count: 4, caloriesPerItem: 100 },
          { name: "banana", count: 1, caloriesPerItem: 150 },
        ],
        dailyAllowedCalories: 1800,
      };

      it("updates the config", async () => {
        await manager.updateConfig(updatedConfig);
        expect(manager.currentConfig).toEqual(updatedConfig);
        expect(manager.currentVersion).toBe(1);
        expect(manager.lastModified).toEqual(clock.now());
      });
    });

    describe("post commit hook", () => {
      let checkbox = "was not called yet!";
      const clock = new ManualClock();
      const manager = new ConfigManager<Config>(initialConfig, noOpLogger, {
        clock,
      });
      const postCommit = async () => {
        checkbox = "was called!";
      };
      manager.registerPostCommitHook(postCommit);

      it("calls the post commit hook after config update", async () => {
        await manager.updateConfig({
          dailyFoods: [],
          dailyAllowedCalories: 0,
        });
        expect(checkbox).toBe("was called!");
      });
    });
  });

  describe("registered consumers", () => {
    // Below are two example consumers that can be registered to the ConfigManager.
    // This is just an example, you can create your own consumers that implement the ConfigConsumer interface.
    // The important thing is to implement the required methods in such a way that allows rollback.
    class VitaminsManager {
      private _numberOfFruits: { current: number; next: number | null } = {
        current: 0,
        next: null,
      };
      name = "VitaminsManager";
      prepareConfig(config: Config): Promise<void> {
        this._numberOfFruits.next = config.dailyFoods
          .filter((food) => food.name === "banana" || food.name === "apple")
          .map((f) => f.count)
          .reduce((a, b) => a + b, 0);
        return Promise.resolve();
      }
      commitConfig(): Promise<void> {
        if (!this._numberOfFruits.next) {
          return Promise.reject(new Error("No fruits found in config"));
        }
        this._numberOfFruits.current = this._numberOfFruits.next;
        this._numberOfFruits.next = 0; // Reset for next update
        return Promise.resolve();
      }
      rollbackConfig(): void {
        this._numberOfFruits.next = null; // Reset next state
      }
      get numberOfFruits(): number {
        return this._numberOfFruits.current;
      }
    }

    class CaloriesManager {
      private _totalCalories: { current: number; next: number | null } = {
        current: 0,
        next: null,
      };
      name = "CaloriesManager";
      prepareConfig(config: Config): Promise<void> {
        if (config.dailyAllowedCalories < 0) {
          return Promise.reject(new Error("Calories cannot be negative"));
        }
        const totalCalories = config.dailyFoods.reduce(
          (sum, food) => sum + food.count * food.caloriesPerItem,
          0
        );
        if (totalCalories > config.dailyAllowedCalories) {
          return Promise.reject(
            new Error("Total calories exceed daily allowed calories")
          );
        }
        this._totalCalories.next = totalCalories;
        return Promise.resolve();
      }
      commitConfig(): Promise<void> {
        if (this._totalCalories.next === null) {
          return Promise.reject(new Error("No calories found in config"));
        }
        this._totalCalories.current = this._totalCalories.next;
        return Promise.resolve();
      }
      rollbackConfig(): void {
        this._totalCalories.next = null; // Reset next state
      }

      get totalCalories(): number {
        return this._totalCalories.current;
      }
    }
    describe("bootstrapping consumers", () => {
      it("notifies registered consumers on initial config", async () => {
        const clock = new ManualClock();
        const manager = new ConfigManager<Config>(initialConfig, noOpLogger, {
          clock,
        });
        const vitaminsManager = new VitaminsManager();
        const caloriesManager = new CaloriesManager();
        manager.registerConsumer(vitaminsManager);
        manager.registerConsumer(caloriesManager);
        // before bootstrap, no consumers should have been notified
        expect(vitaminsManager.numberOfFruits).toBe(0);
        expect(caloriesManager.totalCalories).toBe(0);
        expect(manager.currentVersion).toBe(0);

        // bootstrap the manager to notify consumers and bump up to first version
        await manager.bootstrap();
        expect(vitaminsManager.numberOfFruits).toBe(5);
        expect(caloriesManager.totalCalories).toBe(900);
        expect(manager.currentVersion).toBe(1);

        // calling bootstrap again should not change the state
        await manager.bootstrap();
        expect(vitaminsManager.numberOfFruits).toBe(5);
        expect(caloriesManager.totalCalories).toBe(900);
        expect(manager.currentVersion).toBe(2); // versions does go up though
      });
    });

    describe("distributing a valid config update", () => {
      it("notifies registered consumers", async () => {
        const clock = new ManualClock();
        const manager = new ConfigManager<Config>(initialConfig, noOpLogger, {
          clock,
        });
        const vitaminsManager = new VitaminsManager();
        const caloriesManager = new CaloriesManager();
        manager.registerConsumer(vitaminsManager);
        manager.registerConsumer(caloriesManager);
        await manager.bootstrap();
        expect(vitaminsManager.numberOfFruits).toBe(5);
        expect(caloriesManager.totalCalories).toBe(900);
        expect(manager.currentVersion).toBe(1);

        const updatedConfig: Config = {
          dailyFoods: [
            // 750 calories
            { name: "apple", count: 6, caloriesPerItem: 100 },
            { name: "banana", count: 1, caloriesPerItem: 150 },
          ],
          dailyAllowedCalories: 1800,
        };

        await manager.updateConfig(updatedConfig);
        expect(vitaminsManager.numberOfFruits).toBe(7);
        expect(caloriesManager.totalCalories).toBe(750);
        expect(manager.currentVersion).toBe(2);
      });
    });

    describe("distributing a config update that is considered invalid by one consumer", () => {
      it("rejects the config update across all consumers", async () => {
        const clock = new ManualClock();
        const manager = new ConfigManager<Config>(initialConfig, noOpLogger, {
          clock,
        });
        const vitaminsManager = new VitaminsManager();
        const caloriesManager = new CaloriesManager();
        manager.registerConsumer(vitaminsManager);
        manager.registerConsumer(caloriesManager);
        await manager.bootstrap();
        expect(vitaminsManager.numberOfFruits).toBe(5);
        expect(caloriesManager.totalCalories).toBe(900);
        expect(manager.currentVersion).toBe(1);

        const updatedConfig: Config = {
          dailyFoods: [
            // 800 calories
            { name: "apple", count: 7, caloriesPerItem: 100 },
            { name: "banana", count: 1, caloriesPerItem: 150 },
          ],
          dailyAllowedCalories: 700, // This will cause the CaloriesManager to reject
        };

        await expect(manager.updateConfig(updatedConfig)).rejects.toThrow(
          "Total calories exceed daily allowed calories"
        );
        expect(vitaminsManager.numberOfFruits).toBe(5);
        expect(caloriesManager.totalCalories).toBe(900);
        expect(manager.currentVersion).toBe(1); // Version did not change
      });
    });
  });
  describe("atomicity of config updates", () => {
    class SlowConsumer {
      private _config: { current: Config; next: Config | null };
      get config(): Config {
        return this._config.current;
      }

      name = "SlowConsumer";
      private resolver: (() => void) | null = null;

      constructor() {
        this._config = {
          current: { dailyAllowedCalories: 0, dailyFoods: [] },
          next: null,
        };
      }
      async prepareConfig(_config: Config): Promise<void> {
        this._config.next = _config;
        return new Promise<void>((resolve) => {
          this.resolver = resolve;
        });
      }
      commitConfig(): Promise<void> {
        if (!this._config.next) {
          return Promise.reject(new Error("No config prepared"));
        }
        this._config.current = this._config.next;
        this._config.next = null; // Reset next state
        return Promise.resolve();
      }
      rollbackConfig(): void {
        this._config.next = null; // Reset next state
      }

      finishPrepareConfig(): void {
        if (!this.resolver) {
          throw new Error("prepareConfig was not called or already resolved");
        }
        this.resolver();
        this.resolver = null; // Reset resolver to prevent multiple calls
      }
    }
    it("fails on .updateConfig if there is another call in progress", async () => {
      const clock = new ManualClock();
      const manager = new ConfigManager<Config>(initialConfig, noOpLogger, {
        clock,
      });
      const slowConsumer = new SlowConsumer();
      manager.registerConsumer(slowConsumer);

      const bootstrapPromise = manager.bootstrap(); // no await since it will stuck otherwise
      expect(slowConsumer.config.dailyAllowedCalories).toBe(0);
      expect(slowConsumer.config.dailyFoods).toEqual([]);
      expect(manager.currentVersion).toBe(0);

      slowConsumer.finishPrepareConfig(); // This will resolve the bootstrap
      await bootstrapPromise; // Wait for bootstrap to finish
      expect(slowConsumer.config.dailyAllowedCalories).toBe(2000);
      expect(slowConsumer.config.dailyFoods).toEqual(initialConfig.dailyFoods);
      expect(manager.currentVersion).toBe(1);

      const updateA: Config = {
        dailyFoods: [{ name: "banana", count: 1, caloriesPerItem: 150 }],
        dailyAllowedCalories: 1800,
      };
      const updateB: Config = {
        dailyFoods: [{ name: "apple", count: 8, caloriesPerItem: 100 }],
        dailyAllowedCalories: 1400,
      };

      // Start the first update, we control when it finishes
      const updatePromiseA = manager.updateConfig(updateA);
      expect(slowConsumer.config.dailyAllowedCalories).toBe(2000);
      expect(slowConsumer.config.dailyFoods).toEqual(initialConfig.dailyFoods);
      expect(manager.currentVersion).toBe(1);

      // Start the second update, it should fail immediately
      const updatePromiseB = manager.updateConfig(updateB);
      expect(slowConsumer.config.dailyAllowedCalories).toBe(2000);
      expect(slowConsumer.config.dailyFoods).toEqual(initialConfig.dailyFoods);
      expect(manager.currentVersion).toBe(1);
      await expect(updatePromiseB).rejects.toThrow(
        "Config is currently being updated, please wait for the update to complete."
      );
      expect(slowConsumer.config.dailyAllowedCalories).toBe(2000);
      expect(slowConsumer.config.dailyFoods).toEqual(initialConfig.dailyFoods);
      expect(manager.currentVersion).toBe(1);

      // Now we can finish the first update
      slowConsumer.finishPrepareConfig(); // This will resolve the first update
      await updatePromiseA; // Wait for the first update to finish

      // Now the first update should be applied
      expect(slowConsumer.config.dailyAllowedCalories).toBe(1800);
      expect(slowConsumer.config.dailyFoods).toEqual(updateA.dailyFoods);
      expect(manager.currentVersion).toBe(2);

      // Now we can try the second update again
      const updatePromiseB2 = manager.updateConfig(updateB);
      slowConsumer.finishPrepareConfig(); // This will resolve the second update
      await updatePromiseB2; // Wait for the second update to finish
      expect(slowConsumer.config.dailyAllowedCalories).toBe(1400);
      expect(slowConsumer.config.dailyFoods).toEqual(updateB.dailyFoods);
      expect(manager.currentVersion).toBe(3);
    });
  });
});
