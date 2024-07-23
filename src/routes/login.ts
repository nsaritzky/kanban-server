import { generateCodeVerifier, generateState } from "arctic"
import "dotenv/config"
import express from "express"
import { generateIdFromEntropySize } from "lucia"
import { parseCookies, serializeCookie } from "oslo/cookie"
import { parseJWT } from "oslo/jwt"
import { auth, google } from "../auth.js"
import { User } from "../models/user.js"

interface GoogleUser {
    email: string
    email_verified: boolean
    sub: string
}

const googleLoginRouter = express.Router()

const codeVerifier = generateCodeVerifier()

googleLoginRouter.get("/kanban/login/google", async (_, res) => {
    const state = generateState()
    const url = await google.createAuthorizationURL(state, codeVerifier, {
        scopes: ["email"],
    })
    res.appendHeader(
        "Set-Cookie",
        serializeCookie("google_oauth_state", state, {
            path: "/",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 10,
        }),
    )
        .appendHeader(
            "Set-Cookie",
            serializeCookie("google_oauth_code", codeVerifier, {
                path: "/",
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                maxAge: 60 * 10,
            }),
        )
        .redirect(url.toString())
})

googleLoginRouter.get("/kanban/auth/google/callback", async (req, res) => {
    const code = req.query.code?.toString()
    const state = req.query.state?.toString()
    const cookies = parseCookies(req.headers.cookie ?? "")
    const storedState = cookies.get("google_oauth_state")
    const storedCodeVerifier = cookies.get("google_oauth_code")

    if (!code || !state || state !== storedState || !storedCodeVerifier) {
        return res.status(400).send("Invalid state or code")
    }
    try {
        const tokens = await google.validateAuthorizationCode(
            code,
            storedCodeVerifier,
        )
        const googleUser = parseJWT(tokens.idToken)!.payload as GoogleUser
        let user = await User.findOne({ googleId: googleUser.sub })
        if (!user) {
            user = new User({
                _id: generateIdFromEntropySize(15),
                googleId: googleUser.sub,
                email: googleUser.email,
            })
            await user.save()
        }
        const session = await auth.createSession(user._id, {})
        const sessionCookie = auth.createSessionCookie(session.id)
        return res
            .appendHeader("Set-Cookie", sessionCookie.serialize())
            .redirect(process.env.FRONTEND_URL!)
    } catch (e) {
        console.error(e)
        return res.status(500).send("Failed to retrieve user")
    }
})

googleLoginRouter.get("/kanban/logout", async (_req, res) => {
    const sessionId = res.locals.session?.id ?? ""
    auth.invalidateSession(sessionId)
    res.cookie("isAuthenticated", "false", { httpOnly: false })
    return res.send()
})

googleLoginRouter.get("/kanban/me", async (_req, res) => {
    if (!res.locals.user) {
        return res.status(401).send("Unauthorized")
    } else {
        return res.json(res.locals.user)
    }
})

export default googleLoginRouter
