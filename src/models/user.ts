import mongoose, { Schema, Types } from "mongoose"

export interface IUser {
    _id: string
    email: string
    googleId?: string
    boards: Types.ObjectId[]
}

export const userSchema = new Schema<IUser>(
    {
        _id: { type: String, required: true },
        email: { type: String, required: true },
        googleId: { type: String },
        boards: [{ type: Schema.Types.ObjectId, ref: "Board" }],
    } as const,
    { _id: false },
)

export const User = mongoose.model("User", userSchema)
