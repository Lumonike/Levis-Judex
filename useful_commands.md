# Useful Commands

Most commands should be run from the project directory:

## Development

Run the dev server:

```bash
sudo npm run dev
```

## Checks

Run everything before committing:

```bash
npm test
npm run type-check
npm run lint
npm run build
npm run format:check
```

Fix lint and formatting:

```bash
npm run lint:fix
npm run format
```

## Test Users

Create a verified student account:

```bash
npm run create:test-user -- student@example.com password123
```

Create a verified admin account:

```bash
npm run create:test-user -- admin@example.com password123 --admin
```

Update an existing test user's password or admin status:

```bash
npm run create:test-user -- student@example.com newpassword123 --update
```

## MongoDB

Back up MongoDB:

```bash
mongodump --db authdb --out ./backup-before-migration
```

Restore a backup if needed:

```bash
mongorestore --nsInclude="authdb.*" --drop ./backup-before-migration
```

Open the app database:

```bash
mongosh "mongodb://localhost:27017/authdb"
```

List collections:

```bash
show collections
```

Find users:

```bash
db.users.find()
```

Delete one user:

```bash
db.users.deleteOne({ email: "user@example.com" })
```

Delete all users:

```bash
db.users.deleteMany({})
```

Set a user as admin:

```bash
db.users.updateOne({ email: "user@example.com" }, { $set: { admin: true } })
```

The same pattern works for other collections, such as `problems`, `contests`, `clubs`, and `submissions`.

## Services

Check required services:

```bash
systemctl status mongod
systemctl status isolate
```

Start required services:

```bash
sudo systemctl start mongod
sudo systemctl start isolate
```

Restart required services:

```bash
sudo systemctl restart mongod
sudo systemctl restart isolate
```

## PM2

```bash
pm2 start pm2.json
pm2 stop pm2.json
pm2 reload pm2.json
pm2 status
```
