const express = require('express');

require("../dist/index");
const axios = require('axios');
const app = express();
app.use(express.json())
const port = 8080;
const HTTPBINMOCK_BASE_URL = "http://httpbinmock"
const HEALTHCHECK_RESPONSE = { "status": "OK" }


function _trigger(req, res) {
    console.log("_trigger")
    axios.get(`${HTTPBINMOCK_BASE_URL}/uuid`)
        .then((response) => {
            res.status(response.status).json(response.data);
        })
}

function _trigger_post(req, res) {
    console.log("_trigger_post")
    axios.post(`${HTTPBINMOCK_BASE_URL}/post`, req.body)
        .then((response) => {
            res.status(response.status).json(response.data);
        })
}

function _trigger_headers(req, res) {
    console.log("_trigger_headers")
    axios.get(`${HTTPBINMOCK_BASE_URL}/headers`)
        .then((response) => {
            res.status(response.status).json(response.data);
        })
}

function _trigger_dynamic(req, res) {
    const method = req.query.method
    const url = req.query.url
    axios.request({
        url: url,
        method: method,
    })
        .then((response) => {
            res.status(response.status).json(response.data);
        })
}

function _trigger_retry(req, res) {
    axios.get(`${HTTPBINMOCK_BASE_URL}/anything/retry/attempt`)
        .then((response) => {
            res.status(response.status).json(response.data);
        })
}

function _trigger_local(req, res) {
    axios.get(`${HTTPBINMOCK_BASE_URL}/uuid`)
        .then((response) => {
            res.status(response.status).json(response.data);
        })
}

function _trigger_bad_url(req, res) {
    console.log("_trigger_bad_url")
    axios.get(`${HTTPBINMOCK_BASE_URL}/anything/bad_url`)
        .then((response) => {
            res.status(response.status).json(response.data);
        })
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