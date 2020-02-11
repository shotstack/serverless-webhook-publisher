# Serverless Webhook Publisher

### A simple service for publishing and retrying webhook POSTs to a 3rd party callback URL.

Uses AWS Lambda, SQS and the Serverless Framework. A Consumer receives messages 
from SQS with a payload which it POST's to a callback URL. If the callback POST fails then the message is requeued with an exponential back-off delay.

-----

## Setup

### Serverless Framework

Ensure the Serverless Framework is setup and configured with AWS credentials.
If not, follow the [Serverless Installation Guide](https://serverless.com/framework/docs/providers/aws/guide/installation/).

### Add AWS Account ID

The [serverless.yaml](serverless.yaml) file needs to know your 12 digit [AWS Account ID](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html#FindingYourAWSId).

Copy the `.env.dist` file and rename it to `.env`

```
cp .env.dist .env
```

Edit the .env file and insert your AWS ID next to `AWS_ACCOUNT_ID=`

### Modify header name

The POST callback uses a custom headers to which can be prefixed with your project or service name. Just edit the 
.env file and change `HEADER_NAME`

### Install dependencies

```
npm install
```

### Deploy

```
serverless deploy
```

To deploy to a particular staging environment:

```
serverless deploy --stage [dev|stage|v1]
```

Note: the deployment uses the 
[serverless-stage-manager](https://www.npmjs.com/package/serverless-stage-manager) 
to restrict the environments that can be created. Also the 
[serverless-prune-plugin](https://www.npmjs.com/package/serverless-prune-plugin) 
is used to prune old versions of Lambda functions. Edit or remove these in the 
**serverless.yaml** file to suit your deployment and environment requirements.

-----

## How it works

### Worker/Consumer ([src/worker.js](src/worker.js))

The worker is a Lambda function that listens for messages in an SQS queue.

When a message is received it will try to post the message payload to the provided 
callback URL. If it fails if fails it attempts to requeue the message with a delay 
until the maximum amount of retries is exceeded.

### Subscriber ([src/subscriber.js](src/subscriber.js))

The subscriber is provided as an example only. The subscriber receives the POSTed 
callback data and does something with it (i.e. update a database based on a value 
in the payload. The subscriber should be an external system somewhere on the 
internet.

A `MOCK_SUBSCRIBER_RESPONSE_CODE` environment variable is available that can be 
edited in the Lambda console to test requeueing or success (i.e. set to 200 for
success or 500 to requeue).

### Publishing Messages

Your application would usually publish a message to SQS after it has completed a 
long running process, process or status change (i.e. after completing a video 
render task). For testing you can follow the 
[AWS SQS message sending guide](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-send-message.html) 
to send a message via the AWS Console.

The message should be JSON formatted with the following schema:

**payload:** The main body/data that you want your application to POST to the subscriber.

**url:** The subscriber callback URL that data will be POSTed to.

**eventType:** An optional event type that will be sent as an `X-Shotstack-Event-Type` to the subscriber.

**attempt:** Allows the retry mechanism to keep track of the number of retries it has processed. Defaults to `1` if omitted.

#### Example:
```
{
    "payload": {
        "id": "a6d44d83-a065-4154-b421-4759acd6d4df",
        "status": "complete"
    },
    "url": "https://apigid.execute-api.ap-southeast-2.amazonaws.com/dev/mock-subscriber",
    "eventType": "render",
    "attempt": 1
}
```

-----

## Requeueing

If the worker receives a response error code outside the 200-399 range the 
message will be requeued.

An exponential back-off is used to avoid placing a burden on the server 
receiving the webhook callback. By default the worker will try to requeue 
the message 10 times with a back-off exponent of 3.

The retries will be as follows:

| Attempt | Back-off (sec) | Back-off (min) | Cumulative (sec) | Cumulative (min)
|---|---|---|---|---
| 1 | - | - | 0 | 0
| 2 | 8 | 0:08 | 8 | 0:08
| 3 | 27 | 0:27 | 35 | 0:35
| 4 | 64 | 1:04 | 99 | 1:39
| 5 | 125 | 2:05 | 224 | 3:44
| 6 | 216 | 3:36 | 440 | 7:20
| 7 | 343 | 5:43 | 783 | 13:03
| 8 | 512 | 8:32 | 1295 | 21:35
| 9 | 729 | 12:09 | 2024 | 33:44
| 10 | 900 | 15:00 | 2924 | 48:44

The number of retries and exponent can be adjusted in the worker file. Note that 
SQS has a maximum delivery delay of 900 seconds (15 minutes).
