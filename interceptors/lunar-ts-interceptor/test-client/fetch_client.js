const express = require('express');

require("../dist/index");
const app = express();
app.use(express.json())
const PORT = 8080;
const HTTPBINMOCK_HOST = "httpbinmock"
const HTTPBINMOCK_BASE_URL = `http://${HTTPBINMOCK_HOST}`
const HEALTHCHECK_RESPONSE = { "status": "OK" }


function _trigger(req, res) {
  console.log("_trigger")
  if (global.fetch) {
    try {
        fetch(`${HTTPBINMOCK_BASE_URL}/uuid`).then((response) => {
          console.log(response)
          return response.json()
        }).then((data) => {
          console.log(data)
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        })      
    } catch (error) {
        console.error(error);
        res.writeHead(500);
        res.end('Error calling fetch');
    }
  } else {
      // Ensuring the server can run without crashing in environments with Node.js versions that do not support fetch natively.
      console.log('Fetch API is not available. Make sure you are running Node.js 18 or newer.');
      res.writeHead(200);
      res.end('Fetch API is not available');
  }
}

function _trigger_headers(req, res) {
  console.log("_trigger_headers")
  
  if (global.fetch) {
    try {
        fetch(`${HTTPBINMOCK_BASE_URL}/headers`, {headers: req.headers}).then((response) => {
          console.log(response)
          return response.json()
        }).then((data) => {
          console.log(data)
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        })      
    } catch (error) {
        console.error(error);
        res.writeHead(500);
        res.end('Error calling fetch');
    }
  }
}

function _trigger_dynamic(req, res) {
  const method = req.query.method
  if (method != 'GET') {
    res.status(400).json({error: "method not supported for fetch client. Use GET method instead."})
    return
  }

  const url = req.query.url
  if (global.fetch) {
    try {
        fetch(url).then((response) => {
          console.log(response)
          return response.json()
        }).then((data) => {
          console.log(data)
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        })
    } catch (error) {
        console.error(error);
        res.writeHead(500);
        res.end('Error calling fetch');
    }
  } 
}

async function _trigger_post(req, res) {
  console.log("_trigger_post");

  try {
    const response = await fetch(`${HTTPBINMOCK_BASE_URL}/post`, {
      method: 'POST',
      body: JSON.stringify(req.body),
    });

    const statusCode = response.status;
    const data = await response.json();

    res.status(statusCode).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error processing request' });
  }
}

function _trigger_retry(req, res) {
  if (global.fetch) {
    try {
        fetch(`${HTTPBINMOCK_BASE_URL}/anything/retry/attempt`).then((response) => {
          console.log(response)
          return response.json()
        }).then((data) => {
          console.log(data)
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        })      
    } catch (error) {
        console.error(error);
        res.writeHead(500);
        res.end('Error calling fetch');
    }
  }
}

function _trigger_local(req, res) {
  if (global.fetch) {
    try {
        fetch(`${HTTPBINMOCK_BASE_URL}/uuid`, {headers: req.headers}).then((response) => {
          console.log(response)
          return response.json()
        }).then((data) => {
          console.log(data)
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        })      
    } catch (error) {
        console.error(error);
        res.writeHead(500);
        res.end('Error calling fetch');
    }
  }
}

function _trigger_bad_url(req, res) {
  console.log("_trigger_bad_url")
  if (global.fetch) {
    try {
        fetch(`${HTTPBINMOCK_BASE_URL}/anything/bad_url`).then((response) => {
          console.log(response)
          return response.json()
        }).then((data) => {
          console.log(data)
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        })      
    } catch (error) {
        console.error(error);
        res.writeHead(500);
        res.end('Error calling fetch');
    }
  }
}

function _healthcheck(req, res) {
  console.log("_healthcheck")
  res.status(200).json(HEALTHCHECK_RESPONSE);
}

// Define the routes and associate them with the functions
app.get('/trigger', _trigger);
app.post('/trigger_post', _trigger_post);
app.get('/trigger_headers', _trigger_headers);
app.get('/trigger_dynamic', _trigger_dynamic);
app.get('/trigger_retry', _trigger_retry);
app.get('/trigger_local', _trigger_local);
app.get('/trigger_bad_url', _trigger_bad_url);
app.get('/healthcheck', _healthcheck);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});