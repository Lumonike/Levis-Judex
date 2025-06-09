### service starts:
```
systemctl start mongod
systemctl start isolate
systemctl start online-judge
```
---
### MongoDB
db ssh:  
`mongosh "mongodb://localhost:27017/authdb"`  

get collections:  
`show collections`  

get users:  
`db.users.find()` 

delete user:  
`db.users.deleteOne({ email: "user@example.com" })`  

delete all users:  
`db.users.deleteMany({});`

Same stuff from above applies to problems: just replace `users` with `problems`

---
### run server to see debug console in terminal
`sudo nodejs server.js`

---
### install dependencies
`npm install`
