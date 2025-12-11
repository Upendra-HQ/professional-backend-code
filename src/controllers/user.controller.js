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

    //validation using the syntax you want
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

    //  get file paths from multer (upload.fields)
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

    //  upload to Cloudinary
    const avatarResp = await uploadOnCloudinary(avatarLocalPath);
    const coverResp = coverImageLocalPath ?
        await uploadOnCloudinary(coverImageLocalPath) :
        null;

    if (!avatarResp) {
        throw new ApiError(500, "Unable to upload avatar on cloudinary");
    }

    //  create user in DB
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

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshTken || req.body.refreshToken

    try {
        if (!incomingRefreshToken) {
            throw new ApiError(401, "Refresh token is missing")
        }
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        const user = await User.findById(decodedToken._id)
        if (!user) {
            throw new ApiError(401, "Invalid refresh token - user not found")
        }
        if (user.refreshToken !== incomingRefreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }
        const options = {
            httpOnly: true,
            secure: true,
        }
        const { accessToken, newRefreshToken } = await generateAccessAndRefereshToken(user._id)
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponce(
                    200, {
                        accessToken,
                        newRefreshToken
                    },
                    "Access token refreshed successfully"
                )
            )
    } catch (error) {
        throw new ApiError(401, "Invalid or expired refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "old password and new password are required")
    }
    const user = await User.findById(req.user._id)
    const isPasswordValid = await user.isPasswordCorrect(oldPassword)
    if (!isPasswordValid) {
        throw new ApiError(400, "Old password is incorrect")
    }
    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new ApiResponce(200, null, "Password changed successfully"))

});

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
        .status(200)
        .json(new ApiResponce(200, req.user, "Current user fetched successfully"))
});
const updateAccountSettings = asyncHandler(async(req, res) => {
    const { fullname, email } = req.body
    if (!fullname || !email) {
        throw new ApiError(400, "fullname and email are required")
    }
    const updatedUser = await User.findByIdAndUpdate(req.user._id, {
        $set: {
            fullname,
            email: email
        }
    }, { new: true }).select("-password -refreshToken")
    return res
        .status(200)
        .json(new ApiResponce(200, updatedUser, "User account settings updated successfully"))
});
const updateUserAvatar = asyncHandler(async(req, res) => {
    if (!req.file) {
        throw new ApiError(400, "Avatar image is required");
    }
    const avatarLocalPath = req.file.path;
    const avatarResp = await uploadOnCloudinary(avatarLocalPath);
    if (!avatarResp) {
        throw new ApiError(500, "Unable to upload avatar on cloudinary");
    }
    const updatedUser = await User.findByIdAndUpdate(req.user._id, {
        $set: {
            avatar: avatarResp.secure_url || avatarResp.url,
        }
    }, { new: true }).select("-password -refreshToken");
    return res
        .status(200)
        .json(new ApiResponce(200, updatedUser, "User avatar updated successfully"));
});
const updateUserCoverImage = asyncHandler(async(req, res) => {
    if (!req.file) {
        throw new ApiError(400, "Cover image is required");
    }
    const coverImageLocalPath = req.file.path;
    const coverImageResp = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImageResp) {
        throw new ApiError(500, "Unable to upload cover image on cloudinary");
    }
    const updatedUser = await User.findByIdAndUpdate(req.user._id, {
        $set: {
            coverImage: coverImageResp.secure_url || coverImageResp.url,
        }
    }, { new: true }).select("-password -refreshToken");
    return res
        .status(200)
        .json(new ApiResponce(200, updatedUser, "User cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const { username } = req.params

    if (!username) {
        throw new ApiError(400, "username is required")
    }
    const channel = await User.aggregate([{
            $match: { username: username.toLowerCase() }
        },
        {
            $lookup: {
                from: "subscription",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscription",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: { $size: "$subscribers" },
            },
            channeIsSubscribedToCount: { $size: "$subscribedTo" },
            isSubscribed: {
                $cond: {
                    if: {
                        $in: [req.user._id, "$subscribers.subscriber"]
                    },
                    then: true,
                    else: false
                }
            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                subscribersCount: 1,
                channeIsSubscribedToCount: 1,
                avatar: 1,
                coverImage: 1,
                isSubscribed: 1,
                email: 1
            }
        }

    ])

    if (!channel || channel.length === 0) {
        throw new ApiError(404, "Channel not found")
    }

    return res
        .status(200)
        .json(new ApiResponce(200, channel[0], "Channel profile fetched successfully"))
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountSettings,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile

};