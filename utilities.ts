import { NextFunction, Request, Response } from "express"
import { Types } from "mongoose"

export const toObjectId = (id: string): Types.ObjectId | null =>
    Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null

export const secured = (_req: Request, res: Response, next: NextFunction) => {
    if (!res.locals.user) {
        return res.status(401).send("Unauthorized")
    }
    next()
}

export const arrayMove = <T>(arr: T[], from: number, to: number) => {
    const copy = [...arr]
    const [removed] = copy.splice(from, 1)
    copy.splice(to, 0, removed)
    return copy
}
