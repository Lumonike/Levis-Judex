// ------------------- TEMPORARY FILE --------------------------
// ---------------- WILL BE DELETED SOON -----------------------

// TODO: make this actually functional lol
async function portProblemsToDB() {
    // const problemsDir = path.join(__dirname, "public", "problems");
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
    // const contestTimePath = path.join(__dirname, "public", "contests", "Contest_1", "getContestTime.mjs");
    // const { startTime, endTime } = await import(`file://${contestTimePath}`);
    // const html = fs.readFileSync(path.join(__dirname, "contests", "Contest_1", "A", "index.html"));
    // const inputTestcases = [];
    // for (let i = 1; i <= judge.maxTestcases; i++) {
    //     const possCase = path.join(__dirname, "public", "contests", "Contest_1", "A", "testcases", `${i}.in`);
    //     if (fs.existsSync(possCase)) {
    //         inputTestcases.push(fs.readFileSync(possCase));
    //     } else {
    //         break;
    //     }
    // }
    // const outputTestcases = [];
    // for (let i = 1; i <= judge.maxTestcases; i++) {
    //     const possCase = path.join(__dirname, "public", "contests", "Contest_1", "A", "testcases", `${i}.out`);
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