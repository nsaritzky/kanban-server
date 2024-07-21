import mongoose from "mongoose"

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL!)
        mongoose.set("transactionAsyncLocalStorage", true)
    } catch (error) {
        console.error("Error connecting to MongoDB:", error)
        process.exit(1) // Exit process with failure
    }
}

export default connectDB
