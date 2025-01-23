const core = require('@actions/core');

const { NoProxyUseError, importSDKs } = require('./lunar');
require('../../lunar-ts-interceptor/dist/index');


const SDKS = importSDKs(__dirname + '/sdks');

async function main() {
  console.log('Running SDK tests')
  let failed = false;
  for (const sdk of SDKS) {
    try {
      console.log(`Testing on: ${sdk.getName()}`);
      await sdk.test();

    } catch (e) {
      if (e instanceof NoProxyUseError) {
        failed = true;
        core.error(`No proxy used on ${sdk.getName()}`);
      } else {
        core.warning(`Error on ${sdk.getName()}: ${e}`);
      }
    }
  }

  console.log('Running SDK stream tests')
  for (const sdk of SDKS) {
    try {
      console.log(`Testing stream on: ${sdk.getName()}`);
      await sdk.testStream();

    } catch (e) {
      if (e instanceof NoProxyUseError) {
        failed = true;
        core.error(`No proxy used on ${sdk.getName()}`);
      } else {
        core.warning(`Error on ${sdk.getName()}: ${e}`);
      }
    }
  }
  if (failed) {
    core.setFailed('Some SDK tests failed, check logs for more information');
  }
}

main();