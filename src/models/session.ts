import { Schema } from "mongoose"

export interface Session {
    _id: string
    user_id: string
    expires_at: Date
}

export const sessionSchema = new Schema<Session>(
    {
        _id: { type: String, required: true },
        user_id: { type: String, required: true },
        expires_at: { type: Date, required: true },
    } as const,
    { _id: false },
)
