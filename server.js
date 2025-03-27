require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const judge = require("./judge.js");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI);

const User = mongoose.model("User", new mongoose.Schema({
    email: String,
    password: String,
    verified: { type: Boolean, default: false },
    verificationToken: String,
}));

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// Middleware to block .html file requests
app.use('/', (req, res, next) => {
    if (req.url.endsWith('.html')) {
        return res.status(403).send('Forbidden');
    }
    next();
});

app.use(express.static(__dirname));

// 🚀 **User Registration (with Email Verification)**
app.post("/register", async (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const token = Math.random().toString(36).slice(2);

    const user = new User({ email, password: hashedPassword, verificationToken: token });
    await user.save();

    const link = `http://localhost:3000/verify/${token}`;
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Verify Your Email",
        text: `Click here to verify: ${link}`
    });

    res.json({ message: "Check your email to verify your account!" });
});

// 🚀 **Email Verification**
app.get("/verify/:token", async (req, res) => {
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) return res.status(400).json({ error: "Invalid token" });

    user.verified = true;
    user.verificationToken = null;
    await user.save();

    res.json({ message: "Email verified! You can now log in." });
});

// 🚀 **Login (Only for Verified Users)**
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !await bcrypt.compare(password, user.password))
        return res.status(400).json({ error: "Invalid credentials" });

    if (!user.verified) return res.status(400).json({ error: "Please verify your email first" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
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

// 🚀 **Submit Code**
app.post("/submit", (req, res) => {
    const { code, problem, testcaseCount } = req.body;
    judge.judge(code, problem, testcaseCount).then(result => res.json({ result }));
});

// 🚀 **Available Boxes**
app.post("/available", (req, res) => {
    const result = judge.getBoxID();
    res.json({ result });
});

// 🚀 **Submission Status**
app.post("/subStatus", (req, res) => {
    const { boxID } = req.body;
    const result = judge.getStatus(boxID);
    res.json({ result });
});

// 🚀 **Start the Server**
app.listen(3000, () => console.log("Server running on port 3000"));
