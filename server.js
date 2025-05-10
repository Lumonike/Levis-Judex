require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const judge = require("./judge.js");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const path = require("path")

const app = express();
app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI).then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));


const User = mongoose.model("User", new mongoose.Schema({
    email: String,
    password: String,
    verified: { type: Boolean, default: false },
    verificationToken: String,
    results: { type: Object, default: {} }, // basically a map with the problems to the results
    code: {type: Object, default: {} }
}));

function authenticateToken(req, res, next) {
    // Get token from the Authorization header
    const token = req.headers["authorization"]?.split(" ")[1]; // The token is usually passed as Bearer <token>
    if (!token) {
        return res.status(403).json({ error: "Access denied. No token provided." });
    }

    // Verify the token using JWT secret
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Invalid or expired token." });
        }

        // Attach user data to the request object
        req.user = user;  // The decoded token will contain the user information
        next(); // Proceed to the next middleware or route handler
    });
}



// emailer to email verifcation link
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // true for 465, false for 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Middleware to block .html file requests
app.use('/', (req, res, next) => {
    if (req.url.endsWith('.html')) {
        return res.status(403).send('Forbidden');
    }
    if (req.url.startsWith("/contests/")) {
        return next();
    }
    next();
});


// 🚀 **Email Verification**
app.get("/verify/:token", async (req, res) => {
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) return res.status(400).json({ error: "Invalid token" });

    user.verified = true;
    user.verificationToken = null;
    await user.save();

    // res.json({ message: `Email verified! You can now log in. Login: ${process.env.BASE_URL}/login` });
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Contest Not Started</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-900 text-gray-100">
            <div class="max-w-4xl mx-auto mt-10 p-6 bg-gray-800 shadow-lg rounded-xl">
                <h1 class="text-4xl font-bold text-center mb-6 text-green-400">Email Verified!</h1>
                <p class="text-center text-2xl mb-6">Welcome to the community. Contact us at codejointcrew@gmail.com for any inquiries.</p>
                <div class="text-center">
                    <a href="/login/" class="text-blue-400 hover:underline">← Login</a>
                </div>
            </div>
        </body>
        </html>
    `);
});


// 🚀 **User Registration (with Email Verification)**
app.post("/register", async (req, res) => {
    const { name, email, password } = req.body;

    // Check if the email already exists in the database
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ error: "Email is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const token = Math.random().toString(36).slice(2);

    const user = new User({ email, password: hashedPassword, verificationToken: token });
    await user.save();

    const link = `${process.env.BASE_URL}/verify/${token}`;
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: `${name}: Verify Your Email`,
        text: `Click here to verify: ${link}\n(Link expires in one minute)`
    });

    res.json({ message: "Check your email to verify your account!" });

    // delete unverified accounts after a minute
    setTimeout(async () => {
        console.log("checking for unverified account");
        const updatedUser = await User.findOne({ email });
        if (!updatedUser.verified) {
            await User.deleteOne({ email });
            console.log("Deleted unverified account");
        }
    }, 1000*20);
});

// 🚀 **Login (Only for Verified Users)**
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    console.log("Login attempt:", email); // Debugging

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Incorrect password" });

    if (!user.verified) return res.status(400).json({ error: "Please verify your email first" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "48h" });
    res.json({ success: true, token });
});

// 🚀 **Problems API**
app.post("/problems", (req, res) => {
    const problemsDir = `${__dirname}/problems/`;
    require('fs').readdir(problemsDir, (err, files) => {
        if (err) return res.status(500).json({ error: "Error reading directory" });
        const foldersWithIndex = files.filter(folder => require('fs').existsSync(`${problemsDir}/${folder}/index.html`));
        res.json(foldersWithIndex);
    });
});

// 🚀 **Contests API**
app.post("/contests", (req, res) => {
    const contestsDir = `${__dirname}/contests/`;
    require('fs').readdir(contestsDir, (err, files) => {
        if (err) return res.status(500).json({ error: "Error reading directory" });
        const foldersWithIndex = files.filter(folder => require('fs').existsSync(`${contestsDir}/${folder}/index.html`));
        res.json(foldersWithIndex);
    });
});

app.get("/contests/:contestName/:problemName", async (req, res) => {
    const { contestName, problemName } = req.params;
    if (problemName.endsWith(".js")){
        next();
    }
    try {
        // Dynamically import contest times
        const contestTimePath = path.join(__dirname, "contests", contestName, "getContestTime.mjs");
        const { startTime, endTime } = await import(`file://${contestTimePath}`);
        const now = new Date();

        // Check if contest is active
        if (now < startTime) {
            // Contest not started yet
            return res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Contest Not Started</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                </head>
                <body class="bg-gray-900 text-gray-100">
                    <div class="max-w-4xl mx-auto mt-10 p-6 bg-gray-800 shadow-lg rounded-xl">
                        <h1 class="text-4xl font-bold text-center mb-6 text-red-500">Contest Not Started Yet</h1>
                        <p class="text-center text-2xl mb-6">The contest is scheduled to start at ${startTime.toLocaleString()}</p>
                        <div class="text-center">
                            <a href="/contests/${contestName}" class="text-blue-400 hover:underline">← Back to Contest</a>
                        </div>
                    </div>
                </body>
                </html>
            `);
        } else if (now > endTime) {
            // Contest has ended
            return res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Contest Ended</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                </head>
                <body class="bg-gray-900 text-gray-100">
                    <div class="max-w-4xl mx-auto mt-10 p-6 bg-gray-800 shadow-lg rounded-xl">
                        <h1 class="text-4xl font-bold text-center mb-6 text-red-500">Contest Ended</h1>
                        <p class="text-center text-2xl mb-6">The contest ended on ${endTime.toLocaleString()}</p>
                        <div class="text-center">
                            <a href="/contests/${contestName}" class="text-blue-400 hover:underline">← Back to Contest</a>
                        </div>
                    </div>
                </body>
                </html>
            `);
        }

        // Serve problem file if contest is active
        const problemPath = path.join(__dirname, "contests", contestName, problemName, "index.html");
        res.sendFile(problemPath);
    } catch (error) {
        console.error("Error accessing contest problem:", error);
        res.status(500).json({ error: "Invalid contest or problem." });
    }
});




// 🚀 **Submit Code (requires login)**
app.post("/submit", authenticateToken, async (req, res) => {
    const { code, problem } = req.body;
    // You can access `req.user` which contains the authenticated user's data
    console.log("User ID from token:", req.user.id);
    const user = await User.findById(req.user.id);
    const result = await judge.judge(code, problem);
    res.json({ result });
    // console.log("User:", user);
    user.results[problem] = result;
    user.markModified('results'); // if i don't do this, the data won't save
    // console.log(`Saving this to ${problem}:`, user.results);
    user.code[problem] = code;
    user.markModified('code');
    await user.save();
});

app.post("/getCode", authenticateToken, async (req, res) => {
    const { problem } = req.body;
    const user = await User.findById(req.user.id);
    // console.log("User requesting code:", user);
    if (!user) {
        console.error("WTF NO USER FOUND");
    }
    const result = user.code[problem];
    res.json({ result });
});

// get results from a problem
app.post("/getResult", authenticateToken, async (req, res) => {
    const { problem } = req.body;
    const user = await User.findById(req.user.id);
    // console.log("User requesting result:", user);
    if (!user) {
        console.error("WTF NO USER FOUND");
    }
    const result = user.results[problem]
    res.json({ result });
});


// 🚀 **Available Boxes**
app.post("/available", (req, res) => {
    const result = judge.getBoxID();
    res.json({ result });
});

// 🚀 **Submission Status**
app.post("/subStatus", authenticateToken, (req, res) => {
    const { boxID } = req.body;
    const result = judge.getStatus(boxID);
    res.json({ result });
});

app.use(express.static(__dirname));

// 🚀 **Start the Server**
app.listen(3000, () => console.log("Server running on port 3000"));

