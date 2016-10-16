[![Code Climate](https://codeclimate.com/github/igorshapiro/hubjs/badges/gpa.svg)](https://codeclimate.com/github/igorshapiro/hubjs)

## Usage

### Deployment

```sh
git clone https://github.com/igorshapiro/hubjs.git hubjs
```

### Configuration

Create `services.json` file in the root of the cloned directory:

```json
{
  "services": {
    "pub": {
      "publishes": ["load_test", "pricing_changed"],
      "concurrency": 100
    },
    "sub": {
      "subscribes": ["load_test", "pricing_changed"],
      "endpoint": "http://localhost:3100/:type",
      "concurrency": 100
    }
  }
}
```

The file is an object with `service name`s as keys and `service configurations` as values. The following options are used in service configuration:

- `concurrency` - How many concurrent messages can a service accept.
- `publishes` - Types of messages that the service is publishing (message can't have more than one publisher)
- `subscribes` - Types of messages that the service is subscribed to
- `endpoint` - the HTTP endpoint that accepts the messages. Message is delivered via HTTP POST request. Endpoint can use wildcards:
  - `:type` - message type
  - `:env` - environment, TBD
- `queue` - queue url (currently only `rabbitmq://` supported )
- `intermediate` - intermediate storage url (used for concurrency coordination, processing storage, etc.). Currently only `redis://` supported.
- `storage` - long-term storage url (recurring messages, dead letter, messages archive, etc.). Only `mongodb://` supported

### Running

```sh
npm start
```

## API

### Message format

```js
{
  "messageId": "...",           // Assigned by the hub when publishing a message
  "type": "order_changed",      // Specifies type of the message
  "content": {
    ...
  }
}
```

When a message is published a `messageId` is assigned to it. When published the
message is stored in an `outgoing` queue, and then is copied to the `input`
queues of all subscribers.

### Publishing a message

```sh
POST /api/v1/messages
{
  "type": "order_changed",
  "content": {
    "orderId": "123"
  }
}
```

### Subscribing to a message

All message subscribers are defined in the `services.json` file deployed with the hub.

*Example:* for the following `services.json`

```json
{
  "services": {
    "warehouse": {
      "subscribes": ["order_changed"],
      "endpoint": ["http://warehouse.company.com/handlers/:type"]
    }
  }
}
```

`order_changed` message will be delivered via HTTP POST to `http://warehouse.company.com/handlers/order_changed`.

`Note:` SH uses a `keep-alive` connection to subscribers.

Whenever a message arrives it is delivered to the subscriber.

# Tests

## Delete all queues

```sh
/usr/local/Cellar/rabbitmq/3.6.1/sbin/rabbitmqadmin list queues name | \
  awk '{print $2}' | \
  xargs -I qn /usr/local/Cellar/rabbitmq/3.6.1/sbin/rabbitmqadmin delete queue name=qn
```

# Development

Can use node v4+

```sh
brew install redis mongodb rabbitmq
npm install -g nodemon ember-cli
```

## Design

### Middlewares

- WebServer
- API
- OutQueue
- InQueue
- DeliverMessage (input -> service)
- NewRelic
- StatsD
- Processing storage
- LoadBalancer (concurrency manager)
- Scheduler
- ErrorHandler
- DeadLetter storage
- Archive storage (optional)
- Inspector (inspects messages matching specific criteria and their handlers)
- Bulk messages

# Examples

## Example API calls

Publish a message
```sh
curl -X POST \
  -H"Content-Type: application/json" \
  http://localhost:8080/api/v1/api/messages \
  -d '{"type": "pricing_changed", "content": {}}'
```

Replay messages

```sh
curl -X POST \
  -H"Content-Type: application/json" \
  http://localhost:8080/api/v1/services/sub/archive \
  -d '{"from": 0}'
```

Register recurring message
```sh
curl -X POST \
  -H"Content-Type: application/json" \
  http://localhost:8080/api/v1/services/sub/recurring \
  -d '{"type": "recurring", "deliverEveryMillis": 1000}'
```

Unregister recurring message
```sh
curl -X DELETE http://localhost:8080/api/v1/services/sub/recurring/recurring
```
