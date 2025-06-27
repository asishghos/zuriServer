import { User } from '../models/users.models.js';
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        //finding user from database by _id
        const user = await User.findById(userId)

        //generating Token
        const refreshToken = user.generateRefreshToken()
        const accessToken = user.generateAccessToken()

        //saving refreshToken into the database(access token is not added to database)
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })  //automatically mongoose model(password) kick in so we pass validateBeforeSave to avoid this

        return { accessToken, refreshToken }

    } catch (error) {
        console.log("Error generating tokens:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

// register user
export const registerUser = async (req, res) => {

    //getting user data from req
    const { fullName, email,  password } = req.body  // form-data, json-data is accessed from req.body


    //validating if any filed is empty
    if (
        [fullName, email,  password].some((field) =>
            field?.trim() === "")
    ) {
        return res.status(400).json({ msg: "All fields are required" })
    }


    //checking if user already exits
    const existedUser = await User.findOne({
        $or: [{ email }]   // checking if any of these fields are already in the database
    })

    if (existedUser) {
        return res.status(409).json({ msg: "user already exits" })
    }


    //creating new user in the database
    const user = await User.create({
        fullName,
        email,
        password
    })


    // //checking if user created successfully
    // const createdUser = await User.findById(user._id).select(
    //     "-password -refreshToken"   // don't pass password and refreshToken from response
    // )

    //this will return user data if user is founded if not then
    if (!user) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    //if user created successfully 
    return res.status(201).json({ data: user, msg: "User Registered Successfully" });
};

// login user
export const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ msg: "All fields are required" })
    }

    const user = await User.findOne({
        $or: [{ email }]   // checking if any of these fields are already in the database
    });

    if (!user) {
        return res.status(404).json({ msg: "User not found" })
    };

    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if (!isPasswordCorrect) {
        return res.status(401).json({ msg: "Invalid credentials" })
    };

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"   // don't pass password and refreshToken from response
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json({ data: loggedInUser, msg: "User Logged In Successfully" })
};

// logout user
export const logoutUser = async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, {
        $unset: {
            refreshToken: 1
        }
    }, {
        new: true       // mongoDB response will be new one updated
    })

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .cookie("accessToken", null, options)
        .cookie("refreshToken", null, options)
        .json({ msg: "User Logged Out Successfully" })
}

// refresh access token
export const refreshAccessToken = async (req, res) => {
    try {
        const incomingRefreshToken = req.body.refreshToken;
        if (!incomingRefreshToken) {
            return res.status(400).json({ msg: "Refresh token is required" });
        }
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decodedToken._id);

        if (!user) {
            return res.status(404).json({ msg: "User not found" });
        }
        if (user.refreshToken !== incomingRefreshToken) {
            return res.status(403).json({ msg: "Invalid refresh token" });
        }
        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

        return res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json({ msg: "Access token refreshed successfully", accessToken, newRefreshToken })
    } catch (error) {
        return res.status(500).json({ msg: "Something went wrong while refreshing access token" })
    }
}

// change user password
export const changeUserPassword = async (req, res) => {
    try {
        const user = req.user;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ msg: "All fields are required" });
        }

        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
        if (!isPasswordCorrect) {
            return res.status(401).json({ msg: "Invalid credentials" });
        }

        user.password = newPassword;
        await user.save({ validateBeforeSave: true });
        return res.status(200).json({ msg: "Password changed successfully" });
    } catch (error) {
        return res.status(500).json({ msg: "Something went wrong while changing password" });
    }
}

// get user profile
export const getUserProfile = async (req, res) => {
    try {
        const user = req.user;
        return res.status(200).json({ data: user });
    } catch (error) {
        return res.status(500).json({ msg: "Something went wrong while fetching user profile" });
    }
}

// update user profile
export const updateUserProfile = async (req, res) => {
    try {
        const user = req.user;
        if(!user) {
            return res.status(404).json({ msg: "User not found while updating profile details" });
        }
        const { fullName, email } = req.body;

        if (!fullName || !email ){
            return res.status(400).json({ msg: "All fields are required" });
        }

        user.fullName = fullName;
        user.email = email;

        await user.save({ validateBeforeSave: true });
        return res.status(200).json({ msg: "User profile updated successfully", data: user });
    } catch (error) {
        return res.status(500).json({ msg: "Something went wrong while updating user profile" });
    }
}