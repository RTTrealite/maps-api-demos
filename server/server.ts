// Copyright (c) 2014-2019, EagleView. All rights reserved.

const express = require('express');
const request = require('request');
const ReadWriteLock = require('rwlock');
const cors = require('cors');
import { compositeProductService } from './compositeProductService'
import { urlCreator } from './urlCreator'
import { IToken } from '../shared/IToken';

const app = express();

// These credentials are the Client ID (user) and Client Secret (pass) obtained when you created a client
const clientId = '<YOUR CLIENT ID HERE>';
const clientSecret = '<YOUR CLIENT SECRET HERE>';
// credentials key in the EagleView Account Portal
// This is the API Key obtained when you created an API 
const apiKey = '<YOUR API KEY HERE>';
const apiBaseUrl = 'https://api.au.eagleview.com/api/imagery/v1/';
const authBaseUrl = 'https://internalapi.au.eagleview.com/identity/';

app.use(cors());

app.set('expiryTimeInSecs', -1);
app.set('tokenLock', new ReadWriteLock());

app.get('/api/token', (req, res) => {
    // NOTE: You should be doing your own authentication on the user to ensure you want to allow them to get the access token
    getClientCredentialToken(req).then((token) => {
        res.send(token);
    }).catch(error => {
        res.status(401);
        res.send(error);
    });
});

app.get('/api/config', (req, res) => {
    res.send({ apiKey, apiBaseUrl });
});

app.get('/api/products', async (req, res) => {
    const urlFunc = await urlCreator(req, apiBaseUrl, getClientCredentialToken)
    res.send(await compositeProductService.getCompositeProducts(urlFunc));
});

app.listen(9090, () => console.log('API listening on port 9090!'));

function getClientCredentialToken(req): Promise<IToken> {
    // Store a single active access token at a time.
    return new Promise((resolve, reject) => {
        let lock = req.app.get('tokenLock');

        lock.readLock(releaseRead => {
            let currentTimeInSecs = new Date().getTime() / 1000;
            let accessToken = req.app.get('accessToken');
            let expiryTime = req.app.get('expiryTimeInSecs');

            // Only need a new token if we haven't already got one, or the current one is expired.
            // Take 1min off the expiry time to go and retrieve a new token early. Otherwise, a client
            // might get a token that only lasts for 2secs before having to retrieve another one.
            if (!accessToken || expiryTime - 60 < currentTimeInSecs) {
                // We only want to get one valid token. Generally the first time we are hit will be a client asking for many tiles
                // at once to satisfy their current view, so ensure we only get a token for one of these requests with a lock
                lock.writeLock((releaseWrite) => {
                    clientCredentialRequest(req, resolve, reject);
                    releaseWrite();
                });
            } else {
                // The current token is still active. Need to calculate the remaining time for the current token
                resolve({ access_token: accessToken, expires_in: Math.floor(expiryTime - currentTimeInSecs) });
            }
            releaseRead();
        });
    });
}

function clientCredentialRequest(req, resolve, reject) {
    // Invalidate our current token
    req.app.set('accessToken', undefined);
    let currentTimeInSecs = new Date().getTime() / 1000;

    // Using the client credentials key, you need to authenticate to get a short lived bearer token with the requested
    // scopes which can then be used to make requests to the API.
    request.post(`${authBaseUrl}connect/token`, {
        'form': { 
            // Grant type should always be client credentials in this case
            'grant_type': 'client_credentials',
            // The scope should change depending on what API's you want to call. For getting tiles, we just need imagery
            'scope': 'api:imagery'
        },
        'auth': {
            'user': clientId, 
            'pass': clientSecret 
        }
    }, (error, r, body) => {
        if (error) {
            reject('HTTP error: ' + error);
        } else {
            let response = JSON.parse(body);

            if (typeof(response.error) !== 'undefined') {
                reject('Authentication error: ' + response.error);
            } else {
                // We should have an access token back, store it so we can send it with requests
                req.app.set('accessToken', response.access_token);
                // Need to store when it expires.
                req.app.set('expiryTimeInSecs', currentTimeInSecs + response.expires_in);
                resolve({ access_token: response.access_token, expires_in: response.expires_in });
            }
        }
    });
}