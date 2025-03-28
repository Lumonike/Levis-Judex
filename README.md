# Levis Judex
Creates a judge for problems similar to CodeForces or Leetcode. \
Better version of [Online-Judge](https://github.com/VinkentLi/Online-Judge) \
View [here](https://judge.codejoint.org/)
## How to set up
1. You **need** to run this on Linux, so make sure you have Linux
1. Install [isolate](https://github.com/ioi/isolate) (if you have a debian-based linux distro, make sure to install the service. You can find it by searching "isolate.service" on their github)
2. Install mongodb and instal their service as well, u need mongodb and mongo
3. ensure you have nodejs
4. Set up node by running `npm install`
5. Set up .env file, i.e:
```
PORT=3000
JWT_SECRET=[run node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"]
MONGO_URI=mongodb://localhost:27017/authdb
EMAIL_USER=(make your own email. This email is to send to other's email to verify)
EMAIL_PASS=[enable 2FA on google, next make new app password in security settings, use that here. It should look like "aaaa bbbb cccc dddd"]
BASE_URL=url for your webpage, i.e localhost:3000
```
6. Change the constant in `problems/getServer.js` to be the server you're hosting on
7. Make a `submissions` folder in `problems/test` (we will probably make it so it's already there)
6. Run `sudo node server.js` to initialize the server
7. The test problem can be found in `localhost:3000/problems/test/`
8. [optional] make a online-judge service as shown:
```[Unit]
Description=Levis Judex Server

[Service]
Type=simple
ExecStart=sudo /usr/bin/nodejs [this directory]/server.js
Restart=always
User=root
WorkingDirectory=[this directory]

[Install]
WantedBy=multi-user.target
```
## How to make a problem
*NOTE*:  DO NOT, and I mean DO. NOT. put whitespace into problem names, use underscores as they are automatically converted to whitespace in the problemlist.
1. Add a folder to the `problems` folder
2. copy and paste the `index.html` and `script.js` files from the `test` folder into that folder
3. Modify `index.html` to change the problem statement
4. Modify `script.js` to set the number of testcases you have **(make sure you don't mess this up)**
5. For each testcase, **name them in this format**: `[testcaseNumber].in` for input, `[testcaseNumber].out` for output. testcaseNumber is one-indexed
6. Create a `submissions` folder to host submissions
## Special Thanks
- ChatGPT, for coding like half the project
- DuckDuckGo, for giving us answers from StackOverflow
