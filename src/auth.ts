import { MongodbAdapter } from "@lucia-auth/adapter-mongodb"
import { Google } from "arctic"
import "dotenv/config"
import { Lucia } from "lucia"
import mongoose from "mongoose"
import type { IUser } from "./models/user"

const REDIRECT_URL = "http://api.requirenathan.com/kanban/auth/google/callback"

mongoose.connect(process.env.MONGODB_URL!)

export const auth = new Lucia(
    new MongodbAdapter(
        mongoose.connection.collection("sessions") as any,
        mongoose.connection.collection("users") as any,
    ),
    {
        sessionCookie: {
            attributes: {
                secure: true,
                sameSite: "none",
            },
        },
        getUserAttributes: (attributes) => ({
            email: attributes.email,
            googleId: attributes.googleId,
            boards: attributes.boards,
        }),
    },
)

export const google = new Google(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    REDIRECT_URL,
)

declare module "lucia" {
    interface Register {
        Lucia: typeof auth
        DatabaseUserAttributes: Omit<IUser, "_id">
    }
}
