const express = require('express');
const fs = require('fs');
const path = require("path");
const { Problem } = require('../models.js');
const { createProblemHtml } = require("../pages/problems.js");
const router = express.Router();
module.exports = router;

router.get("/problems/:target", async (req, res) => {
    const target = req.params.target;
    const targetPath = path.join(__dirname, "..", "public", "problems", target);
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
    res.send(createProblemHtml(problem));
});

// TODO: should be GET request
router.post("/problems", async (req, res) => {
    const problems = await Problem.find();
    const data = [];
    problems.forEach((problem) => {
        data.push({ id: problem.id, name: problem.name });
    })
    res.json(data);
});
