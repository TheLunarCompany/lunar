export class ConfigConsumerError extends Error {}
export class ConfigConsumerAlreadyRegisteredError extends ConfigConsumerError {
  constructor(consumerName: string) {
    super(`Config consumer "${consumerName}" is already registered.`);
    this.name = "ConfigConsumerAlreadyRegisteredError";
  }
}
export class ConfigUpdateRejectedError extends ConfigConsumerError {
  readonly failedUpdates: { consumerName: string; error: Error }[];

  constructor(failedUpdates: { consumerName: string; error: Error }[]) {
    const aggErrors = failedUpdates
      .map((f) => `${f.consumerName}: ${f.error.message}`)
      .join(", ");
    super(`Failed to update config for consumers [${aggErrors}]`);

    this.failedUpdates = failedUpdates;
    this.name = "ConfigUpdateRejectedError";
  }
}

export class ConfigFailedToCommitError extends ConfigConsumerError {
  readonly consumerName: string;
  readonly error: Error;
  constructor(consumerName: string, error: Error) {
    super(`Failed to commit config for consumer: ${consumerName}`);
    this.consumerName = consumerName;
    this.error = error;
    this.name = "ConfigFailedToCommitError";
  }
}

export class ConfigInTransitError extends ConfigConsumerError {
  constructor() {
    super(
      "Config is currently being updated, please wait for the update to complete."
    );
    this.name = "ConfigInTransitError";
  }
}
