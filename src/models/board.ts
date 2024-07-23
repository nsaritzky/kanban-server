import mongoose, { Model, Schema, Types } from "mongoose"

export interface Task {
    _id?: Types.ObjectId
    title: string
    description: string
    subtasks: { title: string; completed: boolean }[]
    status: string
}

const taskSchema = new Schema<Task>({
    title: { type: String, required: true },
    description: { type: String, default: "" },
    subtasks: [
        {
            title: { type: String, required: true },
            completed: { type: Boolean, required: true },
        },
    ],
    status: { type: String, required: true },
})

export interface Column {
    title: string
    tasks: Task[]
}

type ColumnHydratedDocument = mongoose.HydratedDocument<
    Column,
    { tasks: mongoose.Types.DocumentArray<Task> }
>
type ColumnModelType = Model<Column, {}, {}, {}, ColumnHydratedDocument>

const columnSchema = new Schema<
    Column,
    ColumnModelType,
    {},
    {},
    {},
    {},
    mongoose.DefaultSchemaOptions,
    Column,
    ColumnHydratedDocument
>({
    title: { type: String, required: true },
    tasks: [taskSchema],
})

export interface IBoard {
    title: string
    columns: Column[]
}

type BoardHydratedDocument = mongoose.HydratedDocument<
    IBoard,
    { columns: mongoose.Types.DocumentArray<Column> }
>
type BoardModelType = Model<IBoard, {}, {}, {}, BoardHydratedDocument>

export const boardSchema = new Schema<
    IBoard,
    BoardModelType,
    {},
    {},
    {},
    {},
    mongoose.DefaultSchemaOptions,
    IBoard,
    BoardHydratedDocument
>({
    title: { type: String, required: true },
    columns: {
        type: [columnSchema],
        validate: {
            validator: (v: Column[]) => {
                const columnTitles = v.map((column) => column.title)
                return columnTitles.length === new Set(columnTitles).size
            },
            message: "Column titles must be unique",
        },
    },
})

export const Board = mongoose.model<IBoard, BoardModelType>(
    "Board",
    boardSchema,
)
