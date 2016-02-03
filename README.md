### Design

#### Middlewares

- WebServer
- API
- RegisterMessage (enqueue outgoing)
- DispatchMessage (outgoing -> inputs)
- DeliverMessage (input -> service)
- NewRelic
- StatsD
- Processing storage
- LoadBalancer (concurrency manager)
- Scheduler
- ErrorHandler
- DeadLetter storage
- Archive storage (optional)

#### Example scenario

- WebServer:
  - Exposes `app` instance
  - On start - the http listener is started
- API
  - needs({web_server => 'webServer'})
  - on initialization:
    - this.
