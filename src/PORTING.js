// ------------------- TEMPORARY FILE --------------------------
// ---------------- WILL BE DELETED SOON -----------------------

const path = require('path');
const fs = require('fs');
const judge = require("./judge.js");
const { User, Problem, Contest } = require("./models.js");

// You should probably backup the database before running this lol
async function portProblemsToDB() {
    await Problem.deleteMany({});
    await Contest.deleteMany({});
    const problemsDir = path.join(__dirname, "public", "problems");
    fs.readdir(problemsDir, async (err, files) => {
        const foldersWithIndex = files.filter(folder => fs.existsSync(path.join(problemsDir, folder, "index.html")));
        for (const folder of foldersWithIndex) {
            const inputTestcases = [];
            for (let i = 1; i <= judge.maxTestcases; i++) {
                const possCase = path.join(problemsDir, folder, "testcases", `${i}.in`);
                if (fs.existsSync(possCase)) {
                    inputTestcases.push(fs.readFileSync(possCase));
                } else {
                    break;
                }
            }
            const outputTestcases = [];
            for (let i = 1; i <= judge.maxTestcases; i++) {
                const possCase = path.join(problemsDir, folder, "testcases", `${i}.out`);
                if (fs.existsSync(possCase)) {
                    outputTestcases.push(fs.readFileSync(possCase));
                } else {
                    break;
                }
            }
            console.log(folder);
            const problemJson = fs.readFileSync(path.join(__dirname, "..", "TEMPORARY", folder + ".json"));
            const problemObject = JSON.parse(problemJson);
            console.log(problemObject);
            problemObject.inputTestcases = inputTestcases;
            problemObject.outputTestcases = outputTestcases;
            const problem = new Problem(problemObject);
            await problem.save();
        }
    });
    // copy over old data. copying stuff from contests causes bugs bcuz im lazy and no one did the contest
    const users = await User.find();
    for (const user of users) {
        for (const [oldProblemName, code] of Object.entries(user.code)) {
            user.code[oldProblemName["/problems/".length]] = code;
        }
        user.markModified("code");
        for (const [oldProblemName, results] of Object.entries(user.results)) {
            user.results[oldProblemName["/problems/".length]] = results;
        }
        user.markModified("results");
        await user.save(); // technically, i could make all the users save at the same time, but I'm lazy lol
    }
    // there was only one contest so im just doing it manually
    const contestTimePath = path.join(__dirname, "public", "contests", "Contest_1", "get-contest-time.mjs");
    const { startTime, endTime } = await import(`file://${contestTimePath}`);
    const inputTestcases = [];
    for (let i = 1; i <= judge.maxTestcases; i++) {
        const possCase = path.join(__dirname, "public", "contests", "Contest_1", "A", "testcases", `${i}.in`);
        if (fs.existsSync(possCase)) {
            inputTestcases.push(fs.readFileSync(possCase));
        } else {
            break;
        }
    }
    const outputTestcases = [];
    for (let i = 1; i <= judge.maxTestcases; i++) {
        const possCase = path.join(__dirname, "public", "contests", "Contest_1", "A", "testcases", `${i}.out`);
        if (fs.existsSync(possCase)) {
            outputTestcases.push(fs.readFileSync(possCase));
        } else {
            break;
        }
    }
    const problem = {
        id: "A", 
        name: "Is Vincent Cooler Than Robin?", 
        problemStatement: "<p>Given a time, output whether Vincent is cooler than Robin</p>",
        inputFormat: "a time",
        outputFormat: "\"yes\"",
        numSampleTestcases: 2,
        inputTestcases: inputTestcases, 
        outputTestcases: outputTestcases,
        contestID: 1
    };
    const contest = new Contest({id: 1, name: "Contest 1", problems: [problem], startTime: startTime, endTime: endTime});
    await contest.save();
}

module.exports = portProblemsToDB;
