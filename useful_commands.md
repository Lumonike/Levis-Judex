# Useful Commands

## service starts

```bash
systemctl start mongod
systemctl start isolate
```

---

## pm2

start server:
`pm2 start pm2.json`

stop server:
`pm2 stop pm2.json`

reload server:
`pm2 reload pm2.json`

check status:
`pm2 status`

---

## MongoDB

db ssh:  
`mongosh "mongodb://localhost:27017/authdb"`

backup db:
`mongodump --db authdb --out ./backup`

restore from backup:
`mongorestore --nsInclude="authdb.*" --drop ./backup`

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

`sudo npm dev`

---

## install dependencies

`npm install`
