// Graceful shutdown handling.
// The `cleanupFns` array will hold functions that need to be called.
// The functions will be executed in reverse order of their registration.
export class GracefulShutdown {
  private static cleanupFns: { name: string; fn: () => Promise<void> }[] = [];
  static registerCleanup(name: string, fn: () => void): void;
  static registerCleanup(name: string, fn: () => Promise<void>): void;
  static registerCleanup(
    name: string,
    fn: (() => void) | (() => Promise<void>),
  ): void {
    const wrapped = (): Promise<void> => Promise.resolve().then(() => fn());
    this.cleanupFns.unshift({ name, fn: wrapped });
  }

  static async shutdown(): Promise<void> {
    for (const { name, fn } of this.cleanupFns) {
      try {
        console.log(`Running cleanup for ${name}...`);
        await fn();
        console.log(`Cleanup for ${name} completed.`);
      } catch (error) {
        console.error(
          `Error during cleanup for ${name}. Shutting down with exit code 1`,
          error,
        );
        process.exit(1);
      }
    }
    console.log(
      "All cleanup functions executed successfully, shutting down with exit code 0",
    );
    process.exit(0);
  }
}
