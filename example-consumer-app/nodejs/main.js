require("lunar-interceptor");
const https = require('https');
const readline = require('readline');

const URL = 'https://catfact.ninja/fact';
const SLEEP_INTERVAL_IN_SEC = 2000; // milliseconds

const getCatFact = () => {
    https.get(URL, (res) => {
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

console.log('Press Enter to get Cat Facts...');
readline.createInterface({
    input: process.stdin,
    output: process.stdout
}).on('line', (input) => {
    const intervalId = setInterval(getCatFact, SLEEP_INTERVAL_IN_SEC);

    console.log(`Sending a request to ${URL} every ${SLEEP_INTERVAL_IN_SEC / 1000} seconds`);
    console.log('Press Enter to stop...\n');
    readline.createInterface({
        input: process.stdin,
        output: process.stdout
    }).on('line', (_) => {
        process.exit();
    });
});
