# Levis Judex
(currently only supports Python) Creates a problem judging platform for problems similar to CodeForces or Leetcode. \
Better version of [Online-Judge](https://github.com/VinkentLi/Online-Judge) \
View our self-hosted page [here](https://judge.codejoint.org/)
## How to set up
*NOTE*:  if you need any help installing the service, feel free to email us at codejointcrew@gmail.com, we are more than willing to help you through the step-by-step process if you need help intalling our service
1. You **need** to run this on Linux, so make sure you have Linux
1. Install [isolate](https://github.com/ioi/isolate) (make sure to install the service and run it from there or it won't work. You can find it by searching "isolate.service" on their github)
2. Install mongodb and install their system service as well, u need mongodb and mongo
3. ensure you have nodejs
4. Set up node by running `npm install`
5. Set up .env file, i.e:
```
PORT=3000
JWT_SECRET=[run node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"]
MONGO_URI=mongodb://localhost:27017/authdb
EMAIL_USER=(make your own email. This email is to send to other's email to verify. we use noreplycodejoint@gmail.com)
EMAIL_PASS=[enable 2FA on google, next make new app password in security settings, use that here. It should look like "aaaa bbbb cccc dddd"]
BASE_URL=url for your webpage, i.e localhost:3000
```
7. Create file `problems/getServer.js` to be the server you're hosting on, i.e
   `export const server = "http://localhost:3000/"`, or, for us, `export const server = "https://judge.codejoint.org/"` (<- do notice i use https:// for mine as it is configured that way in the nginx)
9. Edit the home page so the "About" link and contact us banner reflects you (or leave ours there if you don't mind)
10. Run `sudo node server.js` to initialize the server
11. The test problem can be found in `localhost:3000/problems/test/`
12. [optional] make a online-judge service as shown:
13. [optional] if you want to just check out the submission functionality and don't feel like setting up the email verification system, then:  
    a. "sign up" on the frontend,  
    b. run `mongosh "mongodb://localhost:27017/authdb"` and then `db.users.find()`  
    c. get your verificationToken, and go to [webpage]/verify/{verificationToken}/ i.e http://localhost:3000/verify/39rj84j9/  
    d. after verifying, login and use the website as normal.  
```
[Unit]
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
## How to make a problem (we have template problems already to help you)
*NOTE*:  DO NOT, and I mean DO. NOT. put whitespace into problem names, use underscores as they are automatically converted to whitespace in the problemlist.
1. Add a folder to the `problems` folder
2. copy and paste the `index.html` and `script.js` files from the `test` folder into that folder
3. Modify `index.html` to change the problem statement  
4. For each testcase, **name them in this format**: `[testcaseNumber].in` for input, `[testcaseNumber].out` for output. testcaseNumber is one-indexed
## How to make a contest (we have template contests already to help you)
*NOTE*:  same thing as problems, DO NOT use whitespace when naming anything.
1. Add a folder to `contests` folder
2. Add `index.html` file and `getContestTime.mjs` file.
3. Add problems in the same format as adding problems, but instead add into contest folder.
## Special Thanks
- Brian Dean for informing us of the sandboxing tool USACO uses (ioi isolate, open-sourced on github)
- thanks to ChatGPT for setting the Vibes ~~
