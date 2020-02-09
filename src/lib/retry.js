'use strict';

const Producer = require('sqs-producer');
const region = process.env.SLS_REGION;
const account = process.env.SLS_AWS_ACCOUNT;
const queue = process.env.SLS_SQS_QUEUE_PRIMARY;

const MAX_RETRY_ATTEMPTS = 10;
const MAX_SQS_DELAY = 900;
const DELAY_EXPONENT = 3;

const getBackOffDelay = (attempt) => {
    return Math.min(Math.pow(attempt, DELAY_EXPONENT), MAX_SQS_DELAY);
}

module.exports.requeue = (messageData, messageId) => {
    messageData.attempt = messageData.attempt + 1;
    const delay = getBackOffDelay(messageData.attempt);

    return new Promise((resolve, reject) => {
        if (messageData.attempt > MAX_RETRY_ATTEMPTS) {
            return reject('Max retry attempts exceeded. Giving up.');
        }

        const producer = Producer.create({
            queueUrl: 'https://sqs.' + region + '.amazonaws.com/' + account + '/' + queue,
            region: region
        });

        producer.send([{ id: messageId, body: JSON.stringify(messageData), delaySeconds: delay }], (error) => {
            if (error) {
                return reject(error);
            }

            return resolve('Callback requeued.');
        });
    });
}
