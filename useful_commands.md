# Useful Commands

## service starts

```bash
systemctl start mongod
systemctl start isolate
systemctl start online-judge
```

---

## MongoDB

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

set user as admin (if you don't have access to admin page yet):  
`db.users.updateOne({ email: "user@example.com" }, { $set: { admin: true } })` (you can also generalize this to modify any key of any collection)

Same stuff from above applies to problems and contests: just replace `users` with `problems` or `contests`

---

## run server to see debug console in terminal

`sudo npm start`

---

## install dependencies

`npm install`
