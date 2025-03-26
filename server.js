const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const judge = require("./judge.js");

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use('/', (req, res, next) => {
    if (req.url === "/") {
        return res.redirect("/problems/");
    }
    if (req.url.endsWith('.html')) {
        return res.status(403).send('Forbidden');
    }
    next();
});

app.use(express.static(__dirname));

app.post("/problems", (req, res) => {
    const problemsDir = `${__dirname}/problems/`;
    require('fs').readdir(problemsDir, (err, files) => {
        if (err) return res.status(500).json({ error: "Error reading directory" });
        const foldersWithIndex = files.filter(folder => require('fs').existsSync(`${problemsDir}/${folder}/index.html`));
        res.json(foldersWithIndex);
    });
});

app.post("/submit", (req, res) => {
    const { code, problem, testcaseCount } = req.body;
    judge.judge(code, problem, testcaseCount).then(result => res.json({result}));
});

app.post("/available", (req, res) => {
    const result = judge.getBoxID();
    res.json({result});
});

app.post("/subStatus", (req, res) => {
    const { boxID } = req.body;
    const result = judge.getStatus(boxID);
    res.json({result});
});

app.listen(3000, () => console.log("Server running on port 3000"));
