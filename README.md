# Online Judge
Creates a judge for problems similar to USACO or IOI
## How to set up
1. You **need** to run this on Linux, so make sure you have Linux
1. Install [isolate](https://github.com/ioi/isolate) (if you have a debian-based linux distro, make sure to install the service. You can find it by searching "isolate.service" on their github)
2. Install mongodb and instal their service as well, u need mongodb and mongo
3. Set up node by running `npm install`
4. Run `sudo node server.js` to initialize the server
5. The test problem can be found in `localhost:3000/problems/test/`
## How to make a problem
*NOTE*:  DO NOT, and I mean DO. NOT. put whitespace into problem names, use underscores as they are automatically converted to whitespace in the problemlist.
1. Add a folder to the `problems` folder
2. copy and paste the `index.html` and `script.js` files from the `test` folder into that folder
3. Modify `index.html` to change the problem statement
4. Modify `script.js` to set the number of testcases you have **(make sure you don't mess this up)**
5. For each testcase, **name them in this format**: `[testcaseNumber].in` for input, `[testcaseNumber].out` for output. testcaseNumber is one-indexed
6. Create a `submissions` folder to host submissions
## If you're hosting the grading server on a different server from the website
1. You will need to split the problem folder between the grading server and the website
2. Both the grading server and the website should have a similar folder structure (as described in [How to make a problem](#how-to-make-a-problem)). **If you don't have folders for a problem in both servers, you're gonna have issues with the problems list**
3. On the grading server, you need `server.js`, `judge.js`, `problems/[problemName]/submissions/`, and`problems/[problemName]/testcases/`
4. On the website, you need everything in the `problems` folder that's not on the grading server
5. In `getServer.js`, **replace server with where you're hosting the grading server or it won't work**
## Special Thanks
- [Lumonike](https://github.com/lumonike), for emailing Brian Dean about what USACO uses for judging. We will use this judge for a project we're working on together
- ChatGPT, for coding the base of the code and giving tips lol
- DuckDuckGo, for giving me answers from StackOverflow
