const express = require('express');

require("../dist/index");
const http = require('http');
const { exit } = require('process');
const app = express();
app.use(express.json())
const port = 8080;
const HTTPBINMOCK_HOST = "httpbinmock"
const HTTPBINMOCK_BASE_URL = `http://${HTTPBINMOCK_HOST}`
const HEALTHCHECK_RESPONSE = { "status": "OK" }

function getUrlImport() {
  const version = process.versions.node.split('.')

  if (version.length === 0) {
      console.log("Could not determine the version of NodeJS")
      exit(1)
  }

  const major = version[0]

  if (major !== undefined) {
      if (parseInt(major) > 15) return require('node:url');
  }
  return require('url');
}

function _trigger(req, res) {
  console.log("_trigger")
  const options = {
    hostname: HTTPBINMOCK_HOST,
    port: 80,
    path: '/uuid',
    method: 'GET',
    headers: req.headers,
  }

  var clientReq = http.get(options, (resp) => {
    var statusCode = resp.statusCode
    var data = ''

    resp.on("data", (chunk) => {
      data += chunk;
    });

    resp.on('end', () => {
      res.status(statusCode).json(JSON.parse(data));
    })
  })

  clientReq.end()
}

function _trigger_post(req, res) {
  var body = req.body
  console.log("_trigger_post")
  
  const options = {
    hostname: HTTPBINMOCK_HOST,
    port: 80,
    path: '/post',
    method: 'POST',
  }
  var clientReq = http.request(options, (resp) => {
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
  clientReq.write(JSON.stringify(body))
  clientReq.end()
}

function _trigger_headers(req, res) {
  console.log("_trigger_headers")
  const options = {
    hostname: HTTPBINMOCK_HOST,
    port: 80,
    path: '/headers',
    method: 'GET',
    headers: req.headers,
  }
  
  var clientReq = http.get(options, (resp) => {
    var statusCode = resp.statusCode
    var data = ''

    resp.on("data", (chunk) => {
      data += chunk;
    });

    resp.on('end', () => {
      res.status(statusCode).json(JSON.parse(data));
    })
  })
  
  clientReq.end()
}

function _trigger_dynamic(req, res) {
  const method = req.query.method
  const url = req.query.url

  const options = getUrlImport().urlToHttpOptions(url)
  options.method = method

  var clientReq = http.request(options, (resp) => {
    var statusCode = resp.statusCode
    var data = ''

    resp.on("data", (chunk) => {
      data += chunk;
    });

    resp.on('end', () => {
      res.status(statusCode).json(JSON.parse(data));
    })
  })
  clientReq.end()
}

function _trigger_retry(req, res) {
  var clientReq = http.get(`${HTTPBINMOCK_BASE_URL}/anything/retry/attempt`, (resp) => {
    var statusCode = resp.statusCode
    var data = ''

    resp.on("data", (chunk) => {
      data += chunk;
    });

    resp.on('end', () => {
      res.status(statusCode).json(JSON.parse(data));
    })
  })
  clientReq.end()
}

function _trigger_local(req, res) {
  const options = {
    hostname: HTTPBINMOCK_HOST,
    port: 80,
    path: '/uuid',
    method: 'GET',
    headers: req.headers,
  }
  var clientReq = http.get(options, (resp) => {
    var statusCode = resp.statusCode
    var data = ''

    resp.on("data", (chunk) => {
      data += chunk;
    });

    resp.on('end', () => {
      res.status(statusCode).json(JSON.parse(data));
    })
  })

  clientReq.end()
}

function _trigger_bad_url(req, res) {
  console.log("_trigger_bad_url")
  var clientReq = http.get(`${HTTPBINMOCK_BASE_URL}/anything/bad_url`, (resp) => {
    var statusCode = resp.statusCode
    var data = ''

    resp.on("data", (chunk) => {
      data += chunk;
    });

    resp.on('end', () => {
      res.status(statusCode).json(JSON.parse(data));
    })
  })
  clientReq.end()
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