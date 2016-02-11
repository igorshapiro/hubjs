### Design

#### Middlewares

- WebServer
- API
- OutQueue
- Dispatcher (outgoing -> inputs)
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

#### Example scenario

- WebServer:
  - Exposes `app` instance
  - On start - the http listener is started
- API
  - needs({web_server => 'webServer'})
  - on initialization:
    - this.
