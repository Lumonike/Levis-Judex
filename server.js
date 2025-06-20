/* Levis Judex - Self-hosted platform for contests/problems
 * Copyright (C) 2025 Vincent Li and Robin Wang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const judge = require("./judge.js");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

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
    resetToken: String,
    possibleNewPassword: String,
    results: { type: Object, default: {} }, // basically a map with the problems to the results
    code: { type: Object, default: {} },
    admin: { type: Boolean, default: false }
}));

// making a schema to store it in problems
const ProblemSchema = new mongoose.Schema({
    id: String, // in case we want to do stuff like 5B like codeforces. CANNOT HAVE COLONS
    name: String,
    html: String, // TODO: using html probably isn't the best idea. should make it match contest probably
    inputTestcases: [ String ],
    outputTestcases: [ String ],
    contestID: { type: String, default: null } // null if not a contest problem
});

const Problem = mongoose.model("Problem", ProblemSchema);

const Contest = mongoose.model("Contest", new mongoose.Schema({
    id: String,
    name: String,
    problems: [ ProblemSchema ],
    startTime: Date,
    endTime: Date
}));

async function portProblemsToDB() {
    // const problemsDir = path.join(__dirname, "problems");
    // fs.readdir(problemsDir, async (err, files) => {
    //     const foldersWithIndex = files.filter(folder => fs.existsSync(path.join(problemsDir, folder, "index.html")));
    //     for (const folder of foldersWithIndex) {
    //         const html = fs.readFileSync(path.join(problemsDir, folder, "index.html"));
    //         const inputTestcases = [];
    //         for (let i = 1; i <= judge.maxTestcases; i++) {
    //             const possCase = path.join(problemsDir, folder, "testcases", `${i}.in`);
    //             if (fs.existsSync(possCase)) {
    //                 inputTestcases.push(fs.readFileSync(possCase));
    //             } else {
    //                 break;
    //             }
    //         }
    //         const outputTestcases = [];
    //         for (let i = 1; i <= judge.maxTestcases; i++) {
    //             const possCase = path.join(problemsDir, folder, "testcases", `${i}.out`);
    //             if (fs.existsSync(possCase)) {
    //                 outputTestcases.push(fs.readFileSync(possCase));
    //             } else {
    //                 break;
    //             }
    //         }
    //         const problem = new Problem({ 
    //             id: folder[0], 
    //             name: folder.substring(3).split("_").join(" "),
    //             html: html,
    //             inputTestcases: inputTestcases,
    //             outputTestcases: outputTestcases
    //         });
    //         await problem.save();
    //     }
    // });
    // // copy over old data. copying stuff from contests causes bugs bcuz im lazy and no one did the contest
    // const users = await User.find();
    // for (const user of users) {
    //     for (const [oldProblemName, code] of Object.entries(user.code)) {
    //         user.code[oldProblemName[10]] = code;
    //     }
    //     user.markModified("code");
    //     for (const [oldProblemName, results] of Object.entries(user.results)) {
    //         user.results[oldProblemName[10]] = results;
    //     }
    //     user.markModified("results");
    //     await user.save();
    // }
    // there was only one contest so im just doing it manually
    // const contestTimePath = path.join(__dirname, "contests", "Contest_1", "getContestTime.mjs");
    // const { startTime, endTime } = await import(`file://${contestTimePath}`);
    // const html = fs.readFileSync(path.join(__dirname, "contests", "Contest_1", "A", "index.html"));
    // const inputTestcases = [];
    // for (let i = 1; i <= judge.maxTestcases; i++) {
    //     const possCase = path.join(__dirname, "contests", "Contest_1", "A", "testcases", `${i}.in`);
    //     if (fs.existsSync(possCase)) {
    //         inputTestcases.push(fs.readFileSync(possCase));
    //     } else {
    //         break;
    //     }
    // }
    // const outputTestcases = [];
    // for (let i = 1; i <= judge.maxTestcases; i++) {
    //     const possCase = path.join(__dirname, "contests", "Contest_1", "A", "testcases", `${i}.out`);
    //     if (fs.existsSync(possCase)) {
    //         outputTestcases.push(fs.readFileSync(possCase));
    //     } else {
    //         break;
    //     }
    // }
    // const problem = {
    //     id: "A", 
    //     name: "Is Robin Cooler Than Vincent?", 
    //     html: html, 
    //     inputTestcases: inputTestcases, 
    //     outputTestcases: outputTestcases,
    //     contestID: 1
    // };
    // const contest = new Contest({id: 1, name: "Contest 1", problems: [problem], startTime: startTime, endTime: endTime});
    // await contest.save();
}
// uncomment this to port problems to DB
// portProblemsToDB();

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

async function requireAdmin(req, res, next) {
    const user = await User.findById(req.user.id);
    if (user.admin) {
        next();
    } else {
        res.status(403).json("Invalid access");
    }
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
    }, 1000*60);
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

app.post("/resetPassword", async (req, res) => {
    const { email, password } = req.body;

    // Check if the email already exists in the database
    const user = await User.findOne({ email });
    if (!user) {
        return res.status(400).json({ error: "Email is not registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const token = Math.random().toString(36).slice(2);
    user.resetToken = token;
    user.possibleNewPassword = hashedPassword;
    user.markModified("resetToken");
    user.markModified("possibleNewPassword");
    await user.save();

    const link = `${process.env.BASE_URL}/reset/${token}`;
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Reset your password`,
        text: `If you did NOT request this email, do NOT click the link and instead IGNORE this email so you don't give access to your account to an unknown third-party.\n\nClick here to confirm reset: ${link}\n(Link expires in one minute)`
    });

    res.json({ message: "Check your email to confirm resetting your password!" });

    // delete reset tokens after one minute
    setTimeout(async () => {
        const updatedUser = await User.findOne({ email });
        updatedUser.resetToken = null;
        updatedUser.possibleNewPassword = null;
        updatedUser.markModified("resetToken");
        updatedUser.markModified("possibleNewPassword");
        await updatedUser.save();
    }, 1000*60);
});

app.get("/reset/:token", async (req, res) => {
    const user = await User.findOne({ resetToken: req.params.token });
    if (!user) return res.status(400).json({ error: "Invalid token" });

    user.password = user.possibleNewPassword;
    user.resetToken = null;
    user.possibleNewPassword = null;
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
                <h1 class="text-4xl font-bold text-center mb-6 text-green-400">Password Reset!</h1>
                <p class="text-center text-2xl mb-6">Password successfully reset. Contact us at codejointcrew@gmail.com for any inquiries.</p>
                <div class="text-center">
                    <a href="/login/" class="text-blue-400 hover:underline">← Login</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get("/problems/:target", async (req, res) => {
    const target = req.params.target;
    const targetPath = path.join(__dirname, "problems", target);
    // send files if they exist
    if (fs.existsSync(targetPath)) {
        if (fs.statSync(targetPath).isFile()) {
            return res.sendFile(targetPath);
        }
    }
    const problem = await Problem.findOne({ id: target });
    if (problem == null) {
        // redirect if the file doesn't exist
        return res.redirect("/problems");
    }
    res.send(problem.html);
});

// 🚀 **Problems API**
app.post("/problems", async (req, res) => {
    const problems = await Problem.find();
    const data = [];
    problems.forEach((problem) => {
        data.push({ id: problem.id, name: problem.name });
    })
    res.json(data);
});

// 🚀 **Contests API**
app.post("/contests", async (req, res) => {
    const contests = await Contest.find();
    const data = [];
    contests.forEach((contest) => {
        data.push({ id: contest.id, name: contest.name });
    })
    res.json(data);
});

app.post("/contestProblems", async (req, res) => {
    const { contestID } = req.body;
    const contest = await Contest.findOne({ id: contestID });
    if (!contest) {
        return res.sendStatus(404);
    }
    const data = [];
    contest.problems.forEach((problem) => {
        data.push({ id: problem.id, name: problem.name });
    });
    res.json(data);
});

// startTime and endTime are strings. do Date.parse
app.post("/contestTiming", async (req, res) => {
    const { contestID } = req.body;
    const contest = await Contest.findOne({ id: contestID });
    if (!contest) {
        return res.sendStatus(404);
    }
    res.json({ startTime: contest.startTime, endTime: contest.endTime });
});

// copy paste from problems lmfao
app.get("/contests/:target", async (req, res) => {
    const target = req.params.target;
    const targetPath = path.join(__dirname, "contests", target);
    // send files if they exist
    if (fs.existsSync(targetPath)) {
        if (fs.statSync(targetPath).isFile()) {
            return res.sendFile(targetPath);
        }
    }
    const contest = await Contest.findOne({ id: target });
    if (!contest) {
        // redirect if the file doesn't exist
        return res.redirect("/contests");
    }
    // TODO: Fix problems list thing lmao
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${contest.name}</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-900 text-gray-100">
            <header class="p-4">

                <a href="/contests" class="text-blue-400 hover:underline">← Back to Contest List</a>
            </header>

            <div class="max-w-4xl mx-auto mt-10 p-6 bg-gray-800 shadow-lg rounded-xl">

                <a href="/" style="position: fixed">
                    <svg width="50" height="50" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 9.5L12 3L21 9.5V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V9.5Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M9 21V12H15V21" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </a>

                <h1 class="text-4xl font-bold text-center mb-6">${contest.name}</h1><br>
                <h1 class="text-2xl font-bold text-center mb-6" id="contestTiming"></h1><br>
                <!-- Uncomment to enable link -->
                <div id="problem-list" class="text-2xl space-y-4 block text-blue-400 text-center mb-4"></div>
            </div>

            <style>.hoverUnderline:hover{text-decoration: underline;}</style>
            <script type="module">
                import { getTiming, apply } from "/contests/getTiming.js";
                import { loadProblems } from "/contests/getContestProblems.js";
                let elem = document.getElementById("contestTiming");
                const { startTime, endTime } = await getTiming(${contest.id});
                setInterval(apply, 100, elem, startTime, endTime); // repeat every 100 ms
                loadProblems(${contest.id});
            </script>
        </body>
        </html>    
    `);
});

// TODO: put html stuff into its own file probably cuz this sucks lmfao
app.get("/contests/:contestID/:problemID", async (req, res) => {
    const { contestID, problemID } = req.params;
    const contestDir = path.join(__dirname, "contests", contestID);
    if (fs.existsSync(path.join(contestDir, problemID))) {
        if (fs.statSync(path.join(contestDir, problemID)).isFile()) {
            return res.sendFile(path.join(contestDir, problemID));
        }
    }
    const contest = await Contest.findOne({ id: contestID });
    if (!contest) {
        return res.redirect("/contests");
    }
    const problem = contest.problems.find(problem => problem.id == problemID);
    if (!problem) {
        return res.redirect("../");
    }
    const now = new Date();

    // Check if contest is active
    if (now < contest.startTime) {
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
                        <a href="/contests/${contestID}" class="text-blue-400 hover:underline">← Back to Contest</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } else if (now >= contest.endTime) {
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
                        <a href="/contests/${contestID}" class="text-blue-400 hover:underline">← Back to Contest</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } else {
        return res.send(problem.html);
    }
});

// 🚀 **Submit Code (requires login)**
app.post("/submit", authenticateToken, async (req, res) => {
    const { code, problemID, contestID } = req.body;
    const user = await User.findById(req.user.id);
    let problem = null;
    if (!contestID) {
        problem = await Problem.findOne({ id: problemID });
    } else {
        const contest = await Contest.findOne({ id: contestID });
        if (!contest) {
            return res.sendStatus(400);
        }
        problem = contest.problems.find(problem => problem.id == problemID);
    }
    if (!problem) {
        return res.sendStatus(400);
    }
    const result = await judge.judge(code, problem);
    res.json({ result });
    let combinedID = problemID;
    if (contestID) {
        combinedID = contestID.concat(":", problemID);
    }
    user.results[combinedID] = result;
    user.markModified('results'); // if i don't do this, the data won't save
    user.code[combinedID] = code;
    user.markModified('code');
    await user.save();
});

app.post("/getCode", authenticateToken, async (req, res) => {
    const { problemID, contestID } = req.body;
    const user = await User.findById(req.user.id);
    // console.log("User requesting code:", user);
    if (!user) {
        console.error("WTF NO USER FOUND");
    }
    let combinedID = problemID;
    if (contestID) {
        combinedID = contestID.concat(":", problemID);
    }
    const result = user.code[combinedID];
    res.json({ result });
});

// get results from a problem
app.post("/getResult", authenticateToken, async (req, res) => {
    const { problemID, contestID } = req.body;
    const user = await User.findById(req.user.id);
    // console.log("User requesting result:", user);
    if (!user) {
        console.error("WTF NO USER FOUND");
    }
    let combinedID = problemID;
    if (contestID) {
        combinedID = contestID.concat(":", problemID);
    }
    const result = user.results[combinedID]
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

app.use((req, res, next) => {
    if (req.url.startsWith("/private")) {
        return res.status(403).send("403 Unauthorized");
    }
    next();
})
app.use(express.static(__dirname));

app.post("/getAdminPage", authenticateToken, requireAdmin, async (req, res) => {
    const { folder } = req.body;
    res.sendFile(path.join(__dirname, "private", folder, "index.html"));
});

app.post("/setAdminStatus", authenticateToken, requireAdmin, async (req, res) => {
    const { email, status } = req.body;
    console.log("attempting to change status of ", email);
    const user = await User.findOne( { email: email });
    if (!user) {
        return res.status(400).send("Failed to find user");
    }
    user.admin = status;
    user.markModified("admin");
    await user.save();
    res.json({success: true});
});

// 🚀 **Start the Server**
app.listen(3000, () => console.log("Server running on port 3000"));

