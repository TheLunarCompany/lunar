require("lunar-interceptor");
const https = require('https');
const readline = require('readline');

const URL = 'https://catfact.ninja/fact';
const SLEEP_INTERVAL_IN_SEC = 2000; // milliseconds
const X_LUNAR_CONSUMER_TAG = 'lunar-example-app';
let intervalId = -1;
const userInteraction = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

const getCatFact = () => {
    const options = {
        headers: {
            'x-lunar-consumer-tag': X_LUNAR_CONSUMER_TAG
        }
    };
    https.get(URL, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log(`Cat Fact: ${JSON.parse(data).fact}`);
        });

    }).on('error', (err) => {
        console.log(`Error: ${err.message}`);
    });
};

const onExit = () => {
    clearInterval(intervalId);
    userInteraction.close();
    process.exit();
}

console.log('Press Enter to get Cat Facts...');

userInteraction.on('line', (_) => {
    if (intervalId !== -1) {
        console.log('Got it! Stopping the facts retrieval and exiting...');
        onExit();
    } else {
        console.log(`Will retrieve a cat fact from ${URL} every ${SLEEP_INTERVAL_IN_SEC / 1000} seconds`)
        console.log('Press Enter to stop...\n');
        getCatFact()
        intervalId = setInterval(getCatFact, SLEEP_INTERVAL_IN_SEC);
    }
});

userInteraction.on('SIGINT', () => {
    console.log('Caught interrupt signal (Ctrl+C), exiting...');
    onExit();
});
