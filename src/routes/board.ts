import express from "express"
import mongoose, { Types } from "mongoose"
import { logger } from "../logger.js"
import { Board, Task } from "../models/board.js"
import { User } from "../models/user.js"
import { secured } from "../utilities.js"

const boardRouter = express.Router()

boardRouter.get("/kanban/user/boards", secured, async (_req, res) => {
    try {
        const boards = await Board.find({
            _id: { $in: res.locals.user?.boards },
        }).lean()
        return res.status(200).send({ boards })
    } catch (e) {
        logger.error(e)
        return res.status(500).send(e)
    }
})

boardRouter.get("/kanban/board/:id", secured, async (req, res) => {
    try {
        const objectId = new Types.ObjectId(req.params.id)
        if (!res.locals.user?.boards.includes(objectId)) {
            return res.status(404).send("Board not found")
        }
        const board = await Board.findById(objectId).lean()
        return res.status(200).send(board)
    } catch (e) {
        logger.error(e)
        return res.status(500).send(e)
    }
})

boardRouter.post("/kanban/board/new", secured, async (req, res) => {
    try {
        const board = await mongoose.connection.transaction(async () => {
            const user = res.locals.user
            const board = new Board({ title: req.body.title })
            req.body.columns.forEach((column: { title: string }) => {
                board.columns.push({ title: column.title })
            })
            await board.save()
            user?.boards.push(board._id)
            await User.updateOne({ _id: user?.id }, { boards: user?.boards })
            return board
        })
        return res.status(200).send({ board: board.toJSON() })
    } catch (e) {
        logger.error(e)
        res.status(500).send(e)
    }
})

boardRouter.delete("/kanban/board/:id", secured, async (req, res) => {
    try {
        await Board.findByIdAndDelete(req.params.id)
        return res.status(200).send()
    } catch (e) {
        logger.error(e)
        return res.status(500).send(e)
    }
})

boardRouter.post("/kanban/column", secured, async (req, res) => {
    try {
        const board = await Board.findById(req.body.boardId).orFail()
        // We validate unique column titles this way because of the way Mongoose handles
        // validation of updates to arrays. When using $push, Mongoose does not validate
        // the whole array, only the new element being pushed. This means that we can't
        // use a unique validator on the column title field, because it will only check
        // the new column being pushed, not the whole array.
        if (
            board.columns.map((column) => column.title).includes(req.body.title)
        ) {
            return res.status(400).send("Column already exists")
        }
        board.columns.push({
            title: req.body.title,
        })
        await board.save()
        return res
            .status(200)
            .send({ columnId: board.columns[board.columns.length - 1]._id })
    } catch (e) {
        logger.error(e)
        res.status(500).send(e)
    }
})

boardRouter.patch("/kanban/column", secured, async (req, res) => {
    try {
        const board = await Board.findById(req.body.boardId).orFail()
        if (req.body.columnId) {
            const column = board.columns.id(req.body.columnId)
            if (!column) {
                return res.status(400).send("Invalid column ID")
            }
            column.set({
                title: req.body.titlee,
            })
            await board.save()
            return res.status(200).send()
        }
    } catch (e) {
        logger.error(e)
        res.status(500).send(e)
    }
})

boardRouter.delete("/kanban/column", secured, async (req, res) => {
    try {
        await Board.findByIdAndUpdate(req.body.boardId, {
            $pull: {
                columns: { _id: req.body.columnId },
            },
        })
        return res.status(200).send()
    } catch (e) {
        logger.error(e)
        return res.status(500).send(e)
    }
})

boardRouter.post("/kanban/task", secured, async (req, res) => {
    try {
        const board = await Board.findById(req.body.boardId).orFail()
        const columnId = board.columns.find(
            (col) => col.title === req.body.task.status,
        )?._id
        if (!columnId) {
            return res.status(400).send("Invalid status")
        }
        const column = board.columns.id(columnId)
        column!.tasks.push({
            title: req.body.task.title,
            description: req.body.task.description || "",
            subtasks: req.body.task.subtasks || [],
            status: req.body.task.status,
        })
        await board.save()
        return res.status(200).send({
            taskId: column!.tasks[column!.tasks.length - 1]._id?.toString(),
        })
    } catch (e) {
        logger.error(e)
        res.status(500).send(e)
    }
})

boardRouter.patch("/kanban/task", secured, async (req, res) => {
    try {
        const board = await Board.findById(req.body.boardId).orFail()
        const task = board.columns.reduce<Task | null>((acc, column) => {
            /// @ts-ignore
            const foundTask = column.tasks.id(req.body.taskId)
            return foundTask || acc
        }, null)
        if (!task) {
            return res.status(400).send("Invalid task ID")
        }
        if (req.body.task.status) {
            if (
                !board.columns
                    .map((column) => column.title)
                    .includes(req.body.task.status)
            ) {
                return res.status(400).send("Invalid status")
            }
            if (req.body.task.status !== task.status) {
                // Move task to new column
                // @ts-ignore
                task.parent().tasks.pull(task)
                const newColumn = board.columns.find(
                    (col) => col.title === req.body.task.status,
                )
                newColumn!.tasks.push(task)
            }
        }
        Object.entries(req.body.task).forEach(([key, value]) => {
            // @ts-ignore
            task[key] = value
        })
        await board.save()
        return res.status(200).send()
    } catch (e) {
        logger.error(e)
        res.status(500).send(e)
    }
})

boardRouter.delete("/kanban/task", secured, async (req, res) => {
    try {
        await Board.findByIdAndUpdate(req.body.boardId, {
            $pull: {
                "columns.$[].tasks": { _id: req.body.taskId },
            },
        })
    } catch (e) {
        logger.error(e)
        return res.status(500).send(e)
    }
})

boardRouter.post("/kanban/task/move", secured, async (req, res) => {
    try {
        const board = await Board.findById(req.body.boardId).orFail()
        const task = board.columns.reduce<Task | null>((acc, column) => {
            // @ts-ignore
            const foundTask = column.tasks.id(req.body.taskId)
            return foundTask || acc
        }, null)
        if (!task) {
            return res.status(400).send("Invalid task ID")
        }
        // @ts-ignore
        const oldColumn = task.parent()
        const newColumn = board.columns.find(
            (col) => col.title === (req.body.newStatus || task.status),
        )
        if (
            req.body.position < 0 ||
            req.body.position >= newColumn!.tasks.length
        ) {
            return res.status(400).send("Invalid position")
        }
        oldColumn!.tasks.splice(oldColumn!.tasks.indexOf(task), 1)
        newColumn!.tasks.splice(req.body.position, 0, task)
        await board.save()
        return res.status(200).send()
    } catch (e) {
        logger.error(e)
        res.status(500).send(e)
    }
})

export default boardRouter
