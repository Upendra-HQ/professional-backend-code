import dotenv from "dotenv";
import express from "express"; // <-- missing import
import connectDB from "./db/index.js";
import mongoose from "mongoose"
import { app } from "./app.js"

dotenv.config({
    path: './.env'
});

// Create express app  <-- missing line
//const app = express();

// Middleware (optional)
app.use(express.json());

// Connect to MongoDB
connectDB()
    .then(() => {
        const PORT = process.env.PORT || 8000;
        app.listen(PORT, () => {
            console.log(`Server is running at port: ${PORT}`);
        });
    })
    .catch((err) => {
        console.log("MONGO db connection failed !!!", err);
    });