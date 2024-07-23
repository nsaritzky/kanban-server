import "dotenv/config"
import express from "express"
import { rateLimit } from "express-rate-limit"
import helmet from "helmet"
import { type Session, type User } from "lucia"
import { auth } from "./auth.js"
import connectDB from "./connectDB.js"
import { httpLogger, logger } from "./logger.js"
import boardRouter from "./routes/board.js"
import googleLoginRouter from "./routes/login.js"

const app = express()

connectDB()

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests",
})

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: "Too many requests",
})

// app.use(
//     cors({
//         origin: process.env.FRONTEND_URL,
//         credentials: true,
//         allowedHeaders: ["Content-Type", "Authorization"],
//     }),
// )
app.use(express.json())
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-origin" } }))
app.use(httpLogger)
app.use("/kanban/api/auth", authLimiter)
app.use("/kanban/api", apiLimiter)

app.use(async (req, res, next) => {
    const sessionId = auth.readSessionCookie(req.headers.cookie ?? "")
    if (!sessionId) {
        res.locals.user = null
        res.locals.sessionId = null
        return next()
    }

    const { session, user } = await auth.validateSession(sessionId)
    if (session) {
        res.cookie("isAuthenticated", "true", { httpOnly: false })
    }

    if (session && session.fresh) {
        res.appendHeader(
            "Set-Cookie",
            auth.createSessionCookie(session.id).serialize(),
        )
    }
    if (!session) {
        res.appendHeader(
            "Set-Cookie",
            auth.createBlankSessionCookie().serialize(),
        )
        res.cookie("isAuthenticated", "false", { httpOnly: false })
    }
    res.locals.user = user
    res.locals.session = session
    return next()
})

app.use(googleLoginRouter)
app.use(boardRouter)

app.listen(process.env.PORT, () => {
    logger.info(`Server running on port ${process.env.PORT}`)
})

declare global {
    namespace Express {
        interface Locals {
            user: User | null
            session: Session | null
        }
    }
}
