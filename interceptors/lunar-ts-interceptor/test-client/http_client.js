const express = require('express');

require("../dist/index");
const http = require('http');
const nodejs_url = require('node:url')
const app = express();
app.use(express.json())
const port = 8080;
const HTTPBINMOCK_HOST = "httpbinmock"
const HTTPBINMOCK_BASE_URL = `http://${HTTPBINMOCK_HOST}`
const HEALTHCHECK_RESPONSE = { "status": "OK" }


function _trigger(req, res) {
  console.log("_trigger")

  var req = http.get(`${HTTPBINMOCK_BASE_URL}/uuid`, (resp) => {
    var statusCode = resp.statusCode
    var data = ''

    resp.on("data", (chunk) => {
      data += chunk;
    });

    resp.on('end', () => {
      res.status(statusCode).json(JSON.parse(data));
    })
  })
  req.end()
}

function _trigger_post(req, res) {
  var body = req.body
  console.log("_trigger_post")
  console.log(body)
  console.log("_trigger_post")
  const options = {
    hostname: HTTPBINMOCK_HOST,
    port: 80,
    path: '/post',
    method: 'POST',
  }
  var req = http.request(options, (resp) => {
    var statusCode = resp.statusCode
    var data = ''

    resp.on("data", (chunk) => {
      data += chunk;
    });

    resp.on('end', () => {
      res.status(statusCode).json(JSON.parse(data));
    })
  })
  console.log(JSON.stringify(body))
  req.write(JSON.stringify(body))
  req.end()
}

function _trigger_headers(req, res) {
  console.log("_trigger_headers")
  var req = http.get(`${HTTPBINMOCK_BASE_URL}/headers`, (resp) => {
    var statusCode = resp.statusCode
    var data = ''

    resp.on("data", (chunk) => {
      data += chunk;
    });

    resp.on('end', () => {
      res.status(statusCode).json(JSON.parse(data));
    })
  })
  req.end()
}

function _trigger_dynamic(req, res) {
  const method = req.query.method
  const url = req.query.url

  const options = nodejs_url.urlToHttpOptions(url)
  options.method = method

  var req = http.request(options, (resp) => {
    var statusCode = resp.statusCode
    var data = ''

    resp.on("data", (chunk) => {
      data += chunk;
    });

    resp.on('end', () => {
      res.status(statusCode).json(JSON.parse(data));
    })
  })
  req.end()
}

function _trigger_retry(req, res) {
  var req = http.get(`${HTTPBINMOCK_BASE_URL}/anything/retry/attempt`, (resp) => {
    var statusCode = resp.statusCode
    var data = ''

    resp.on("data", (chunk) => {
      data += chunk;
    });

    resp.on('end', () => {
      res.status(statusCode).json(JSON.parse(data));
    })
  })
  req.end()
}

function _trigger_local(req, res) {
  var req = http.get(`${HTTPBINMOCK_BASE_URL}/uuid`, (resp) => {
    var statusCode = resp.statusCode
    var data = ''

    resp.on("data", (chunk) => {
      data += chunk;
    });

    resp.on('end', () => {
      res.status(statusCode).json(JSON.parse(data));
    })
  })
  req.end()
}

function _trigger_bad_url(req, res) {
  console.log("_trigger_bad_url")
  var req = http.get(`${HTTPBINMOCK_BASE_URL}/anything/bad_url`, (resp) => {
    var statusCode = resp.statusCode
    var data = ''

    resp.on("data", (chunk) => {
      data += chunk;
    });

    resp.on('end', () => {
      res.status(statusCode).json(JSON.parse(data));
    })
  })
  req.end()
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
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});