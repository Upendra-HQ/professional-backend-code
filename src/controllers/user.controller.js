import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/User.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponce } from "../utils/ApiResponce.js";
import { upload } from "../middlewares/multer.middleware.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefereshToken = async(userId) => {
    try {
        const user = await User.findById(userId)
        if (!user) throw new Error("User not found while generating tokens");

        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}
const registerUser = asyncHandler(async(req, res) => {
    // get user details from frontend
    // validation-not empty
    // check if user already exists
    // check for images , check for avatar
    // upload them to cloudinary
    // create user object- create entry in db
    // remove password and refresh token field from response
    // check for user creation 
    // return res
    // Debug logs – good while developing
    console.log("=== REGISTER USER UPLOAD DIAGNOSTIC ===");
    console.log("req.files:", JSON.stringify(req.files, null, 2));
    console.log("req.body:", req.body);

    const { fullname, email, username, password } = req.body;

    // ✅ validation using the syntax you want
    if ([fullname, email, username, password].some(f => !f || f.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    // check if user already exists
    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    // ✅ get file paths from multer (upload.fields)
    const avatarLocalPath =
        req.files && req.files.avatar && req.files.avatar[0] ?
        req.files.avatar[0].path :
        undefined;

    const coverImageLocalPath =
        req.files && req.files.coverImage && req.files.coverImage[0] ?
        req.files.coverImage[0].path :
        undefined;

    console.log("avatarLocalPath:", avatarLocalPath);
    console.log("coverImageLocalPath:", coverImageLocalPath);

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // ✅ upload to Cloudinary
    const avatarResp = await uploadOnCloudinary(avatarLocalPath);
    const coverResp = coverImageLocalPath ?
        await uploadOnCloudinary(coverImageLocalPath) :
        null;

    if (!avatarResp) {
        throw new ApiError(500, "Unable to upload avatar on cloudinary");
    }

    // ✅ create user in DB
    const user = await User.create({
        fullname,
        email,
        username: username.toLowerCase(),
        password,
        avatar: avatarResp.secure_url || avatarResp.url, // prefer secure_url
        coverImage: coverResp ? (coverResp.secure_url || coverResp.url) : "",
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering user");
    }

    return res
        .status(201)
        .json(new ApiResponce(201, "User registered successfully", createdUser));
});

const loginUser = asyncHandler(async(req, res) => {
    // req body -> data
    // username or email
    // find the user
    //password check
    // access and refresh token
    // send cookie

    const { email, username, password } = req.body
    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (!user) {
        throw new ApiError(400, "user does not exist")
    }
    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(400, "Invalid user Password ")
    }
    const { accessToken, refreshToken } = await generateAccessAndRefereshToken(user._id)

    const loggedInUser = await User.findById(user.id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: false,
        sameSite: "Lax"
    }
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponce(
                200, {
                    user: loggedInUser,
                    accessToken,
                    refreshToken
                },
                "User logged in Successfully"
            )
        )

});

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(req.user._id, {
        $set: {
            refreshToken: null
        }
    }, { new: true })

    const options = {
        httpOnly: true,
        secure: true,
    }
    return res
        .status(200)
        .clearCookie("accessToken", null, options)
        .clearCookie("refreshToken", null, options)
        .json(new ApiResponce(200, null, "User logged out successfully"))
})

export {
    registerUser,
    loginUser,
    logoutUser
};