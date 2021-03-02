'use strict';

const axios = require('axios');
const retry = require('./lib/retry');

const RESPONSE_TIMEOUT_AFTER_MS = 10000;

module.exports.consume = async event => {
    const messageData = JSON.parse(event.Records[0].body);
    const messageId = event.Records[0].messageId;
    const payload = messageData.payload;
    const eventType = messageData.eventType || null;
    const url = messageData.url;
    const headerName = process.env.HEADER_NAME || 'Shotstack';

    const config = {
        headers: {
            ['X-' + headerName + '-Event-Type']: eventType,
            ['X-' + headerName + '-Attempt']: messageData.attempt || 1,
            'User-Agent': headerName + '-Webhook/1.0',
            'Content-Type': 'application/json'
        },
        timeout: RESPONSE_TIMEOUT_AFTER_MS
    }

    try {
        console.log('Sending callback to: ', url);
        console.log('Payload: ', payload);
        const response = await axios.post(url, payload, config);

        if (response.status < 200 || response.status >= 400) {
            try {
                const requeued = await retry.requeue(messageData, messageId);
                console.log(requeued);
            } catch (error) {
                console.log(error);
            }
        }

        console.log('Callback successfully delivered.')
    } catch (error) {
        if (error.code && error.code === 'ECONNABORTED') {
            console.error('Response exceeded timeout of : '  + RESPONSE_TIMEOUT_AFTER_MS + 'ms');
        }

        if (error.response && error.response.status) {
            console.error('Callback POST failed with status code: '  + error.response.status);
        }

        try {
            const requeued = await retry.requeue(messageData, messageId);
            console.log(requeued);
        } catch (error) {
            console.log(error);
        }
    }
};
