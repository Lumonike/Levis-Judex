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

Same stuff from above applies to problems and contests: just replace `users` with `problems` or `contests`

---
### run server to see debug console in terminal
`sudo npm start`

---
### install dependencies
`npm install`
