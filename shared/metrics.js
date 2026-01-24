import client from "prom-client";

/**
 * Создает набор метрик и хелперов для сервиса.
 * @param {string} serviceName
 */
export function createMetrics(serviceName) {
  const register = new client.Registry();

  client.collectDefaultMetrics({
    register,
    prefix: `${serviceName}_`,
  });

  const httpRequests = new client.Counter({
    name: "http_requests_total",
    help: "HTTP requests",
    labelNames: ["service", "method", "path", "status"],
    registers: [register],
  });

  const httpDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration",
    labelNames: ["service", "method", "path"],
    buckets: [0.05, 0.1, 0.3, 1, 3, 10],
    registers: [register],
  });

  const forwardRequests = new client.Counter({
    name: "forward_requests_total",
    help: "External/forward requests",
    labelNames: ["service", "target", "status"],
    registers: [register],
  });

  const forwardDuration = new client.Histogram({
    name: "forward_request_duration_seconds",
    help: "External/forward request duration",
    labelNames: ["service", "target", "result"],
    buckets: [0.05, 0.1, 0.3, 1, 3, 10, 30],
    registers: [register],
  });

  const httpMiddleware = (req, res, next) => {
    const end = httpDuration.startTimer({
      service: serviceName,
      method: req.method,
      path: req.path,
    });

    res.on("finish", () => {
      httpRequests.inc({
        service: serviceName,
        method: req.method,
        path: req.path,
        status: res.statusCode,
      });
      end();
    });

    next();
  };

  const recordForward = (target, status, durationSeconds, result = "ok") => {
    forwardRequests.inc({
      service: serviceName,
      target,
      status,
    });
    if (durationSeconds !== undefined) {
      forwardDuration.observe({ service: serviceName, target, result }, durationSeconds);
    }
  };

  const metricsHandler = async (req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  };

  return { httpMiddleware, recordForward, metricsHandler, register, client };
}
