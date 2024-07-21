import cors from "cors"
import "dotenv/config"
import express from "express"
import { verifyRequestOrigin, type Session, type User } from "lucia"
import { auth } from "./auth"
import connectDB from "./connectDB"
import boardRouter from "./routes/board"
import googleLoginRouter from "./routes/login"

const url = process.env.MONGODB_URL

const app = express()

connectDB()

app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
    if (req.method == "GET") {
        return next()
    }
    const originHeader = req.headers.origin
    const hostHeader = req.headers.host
    if (
        !originHeader ||
        !hostHeader ||
        !verifyRequestOrigin(originHeader, [hostHeader])
    ) {
        return res.status(403).send("Invalid origin")
    }
    return next()
})

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

app.listen(3000)

declare global {
    namespace Express {
        interface Locals {
            user: User | null
            session: Session | null
        }
    }
}
