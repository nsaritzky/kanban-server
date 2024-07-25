import pino from "pino"
import pinoHttp from "pino-http"

const stream = pino.destination({ dest: "logs/server.log" })

export const logger =
  process.env.NODE_ENV === "production"
    ? pino(stream)
    : pino({
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
          },
        },
      })

export const httpLogger = pinoHttp({
  logger,
  serializers: {
    req: pino.stdSerializers.wrapRequestSerializer((req) => {
      return {
        id: req.raw.id,
        method: req.raw.method,
        path: req.raw.url?.split("?")[0], // Remove query params which might be sensitive
        // Allowlist useful headers
        headers: {
          host: req.raw.headers.host,
          "user-agent": req.raw.headers["user-agent"],
          referer: req.raw.headers.referer,
        },
      }
    }),
    res: pino.stdSerializers.wrapResponseSerializer((res) => {
      return {
        statusCode: res.raw.statusCode,
        // Allowlist useful headers
        headers: {
          // @ts-ignore
          "content-type": res.raw.headers["content-type"],
          // @ts-ignore
          "content-length": res.raw.headers["content-length"],
        },
      }
    }),
  },
})
