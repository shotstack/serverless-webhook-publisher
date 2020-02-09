'use strict';

const axios = require('axios');
const retry = require('./lib/retry');

// Todo:
// Timeout/Requeue if no response within 15 seconds
module.exports.consume = async event => {
    const messageData = JSON.parse(event.Records[0].body);
    const messageId = event.Records[0].messageId;
    const payload = messageData.payload;
    const eventType = messageData.eventType || null;
    const url = messageData.url;

    const config = {
        headers: {
            'X-Shotstack-Event-Type': eventType,
            'X-Shotstack-Attempt': messageData.attempt || 1,
            'User-Agent': 'Shotstack-Webhook/1.0',
            'Content-Type': 'application/json'
        }
    }

    try {
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
        console.error('Callback POST failed with status code: '  + error.response.status);

        try {
            const requeued = await retry.requeue(messageData, messageId);
            console.log(requeued);
        } catch (error) {
            console.log(error);
        }
    }
};
