import { Router } from "express";
import { loginUser, logoutUser, registerUser, refreshAccessToken } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
    upload.fields([{
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]), registerUser);

router.route("/login").post(loginUser)

//secured routes
router.route("/logout").post(verifyJWT, logoutUser)

router.get("/debug", (req, res) => {
    res.json({
        now: new Date().toISOString(),
        cookies: req.cookies || null,
        authorizationHeader: req.header("Authorization") || null,
        originHeader: req.header("Origin") || null
    });
});
// secured routes
router.route("/refresh-token").post(verifyJWT, refreshAccessToken)

export default router;