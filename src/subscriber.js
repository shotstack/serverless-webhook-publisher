'use strict';

module.exports.subscribe = async event => {
    const payload = JSON.parse(event.body);
    console.log(payload, event.headers);

    let responseCode = process.env.MOCK_SUBSCRIBER_RESPONSE_CODE;

    return {
        statusCode: responseCode
    }
};
