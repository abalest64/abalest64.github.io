# Deploy to Render

This app now supports deployment as a Render Web Service.

## Files added for deployment

- `package.json`
- `render.yaml`
- `/health` endpoint in `server.js`

## Recommended setup on Render

1. Push this project to a GitHub repository.
2. In Render, create a new **Web Service** from that repository.
3. Render should detect:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Keep these environment values:
   - `HOST=0.0.0.0`
   - `PORT` is provided automatically by Render

## Important note about data

This app stores users, contacts, appointments, arsenal items, and games in local JSON files.

Render web services use an **ephemeral filesystem by default**, which means local file changes can be lost on redeploy or restart.

If you want those JSON files to persist, add a **persistent disk** in Render and set:

- `DATA_DIR=/opt/render/project/src/data`

Then create a disk mounted at:

- `/opt/render/project/src/data`

Without a persistent disk, the app will still deploy and run, but edits to app data may reset after deploys/restarts.

## Suggested repo type

Use a normal GitHub repository for this app, not a GitHub Pages repo, because this project needs the Node/Express backend to run.
