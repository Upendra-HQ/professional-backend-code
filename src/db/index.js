import mongoose from "mongoose";
import { DB_NAME } from "../constant.js";

const connectDB = async() => {
    try {
        const uri = process.env.MONGODB_URI;

        // Debug print – confirms what your app is actually reading
        console.log("MONGO URI (masked):", uri.replace(/:(.*?)@/, ":***@"));

        if (!uri) {
            console.error("❌ MONGODB_URI is not set in .env");
            process.exit(1);
        }

        const connectionInstance = await mongoose.connect(`${uri}/${DB_NAME}`);
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.log("MONGODB connection error", error);
        process.exit(1);
    }
};

export default connectDB;