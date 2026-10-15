# 08 · Setup & Running

## Prerequisites
- Node.js ≥ 20 (developed on v24)
- MongoDB running locally on `mongodb://127.0.0.1:27017` (or set `MONGO_URI`)

## Install & import
```bash
cd server
npm install
npm run import          # ~30 s; re-runnable (clears & reloads the collection)
```
Optional env (`server/.env`):
```
MONGO_URI=mongodb://127.0.0.1:27017/bookable
PORT=5050
CSV_PATH=/absolute/path/to/Books.csv
```

## Run
```bash
# terminal 1
cd server && npm start         # or: npm run dev (auto-reload)
# terminal 2
cd client && npm install && npm run dev
```
Open **http://localhost:5173**. The header badge turns green once the engine index is built (~8 s).

## Production build
```bash
cd client && npm run build     # outputs client/dist
```
Serve `client/dist` from any static host and point `/api` to the Express server.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `ECONNREFUSED 127.0.0.1:27017` | start `mongod` |
| API returns 503 | index still building — wait a few seconds |
| Search returns nothing | run `npm run import` (creates the text index) |
| `npm` EACCES on `~/.npm` | `sudo chown -R $(id -u):$(id -g) ~/.npm` or use `--cache /tmp/npmcache` |
