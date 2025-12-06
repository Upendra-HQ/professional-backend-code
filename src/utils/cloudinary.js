import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// 🔹 Use values from .env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🔹 Upload local file path to Cloudinary
const uploadOnCloudinary = async(localFilePath) => {
    try {
        if (!localFilePath) {
            console.log("Cloudinary: no localFilePath received");
            return null;
        }

        console.log("Cloudinary: uploading file:", localFilePath);

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });

        console.log("Cloudinary upload success:", {
            public_id: response.public_id,
            secure_url: response.secure_url,
        });

        // delete temp file after upload
        fs.unlinkSync(localFilePath);

        return response;
    } catch (error) {
        console.log("Cloudinary upload error:", error);
        return null;
    }
};

export { uploadOnCloudinary };