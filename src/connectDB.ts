import mongoose from "mongoose"
import { logger } from "./logger"

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL!)
        mongoose.set("transactionAsyncLocalStorage", true)
    } catch (error) {
        logger.error("Error connecting to MongoDB:", error)
        process.exit(1) // Exit process with failure
    }
}

export default connectDB
