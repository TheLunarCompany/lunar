export interface ConfigConsumer<T> {
  /*
   * The name of the consumer.
   * This is used for logging and debugging purposes.
   */
  name: string;

  /**
   * Prepare the consumer for a new config.
   * This is called before the config is actually updated.
   * It allows the consumer to validate the new config and prepare for committing the update.
   * If config is not valid, this should return a rejected promise with a clear error.
   */
  prepareConfig(newConfig: T): Promise<void>;

  /**
   * Commit the new config.
   * This is called after the config is updated.
   * If this fails for one or more `ConfigConsumer`s, the update will be rolled back.
   * This method is expected to perform a swap of state.
   * It may return a rejected promise if the commit fails.
   */
  commitConfig(): Promise<void>;

  /**
   * Rollback the config to the previous state.
   * This is called if one or more `ConfigConsumer`'s `prepareConfig` or `commitConfig` fails.
   * This method must never throw an error, only clean up prepared state.
   */
  rollbackConfig(): void;
}
