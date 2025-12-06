import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/User.model.js";

export const verifyJWT = asyncHandler(async function(req, res, next) {
    // simple debug (optional)
    console.debug("verifyJWT headers:", req.headers);
    console.debug("verifyJWT cookies:", req.cookies);

    // token from cookie or header
    var cookieToken = (req.cookies && req.cookies.accessToken) ? req.cookies.accessToken : null;
    var authHeader = req.get && (req.get("Authorization") || req.get("authorization")) ? (req.get("Authorization") || req.get("authorization")) : null;
    var headerToken = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : null;
    var token = cookieToken || headerToken;

    if (!token) {
        return next(new ApiError(401, "Unauthorized, token is missing"));
    }

    var decoded;
    try {
        decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
        if (err && err.name === "TokenExpiredError") {
            return next(new ApiError(401, "Unauthorized, token expired"));
        }
        if (err && err.name === "JsonWebTokenError") {
            return next(new ApiError(401, "Unauthorized, invalid token"));
        }
        return next(new ApiError(401, "Unauthorized, token verification failed"));
    }

    // debug token
    console.debug("verifyJWT decoded:", decoded);

    // compatible check for id fields (no optional chaining)
    var possibleId = decoded && (decoded.userId || decoded.id || decoded._id || decoded.sub);
    if (!possibleId) {
        return next(new ApiError(401, "Unauthorized, token payload missing user id"));
    }

    // fetch user
    var user = await User.findById(possibleId).select("-password -refreshToken");
    if (!user) {
        console.debug("verifyJWT: user not found for id:", possibleId);
        return next(new ApiError(401, "Unauthorized, user not found"));
    }

    req.user = user;
    next();
});