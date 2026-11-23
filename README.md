# Last One Standing — 6-player arena

A browser-based third-person multiplayer arena prototype using Three.js, Express and Socket.IO.

## Run locally
1. Install Node.js 18 or newer.
2. Extract this folder.
3. In this folder run:
   ```bash
   npm install
   npm start
   ```
4. Open `http://localhost:3000`.

## Make it playable through a shared internet link
Deploy this project to a Node.js hosting service that supports WebSockets (for example Render, Railway, or a VPS). Set the start command to `npm start`. Use the public HTTPS URL. The room creator shares the invite link generated in the lobby; friends open it, enter a name and join.

For local testing with friends on the same Wi-Fi, use the host computer's LAN IP and port 3000. Allow inbound TCP port 3000 in the host firewall.

## Controls
- WASD: move
- Space: jump
- Mouse: aim / rotate
- Left mouse: shoot
- Click the game view to capture the mouse; press Esc to release it.

## Notes
- Rooms support up to six players.
- A match needs at least two players to start.
- The last living player wins.
- This is a playable starter project, not a production anti-cheat implementation. Movement and hit validation should be hardened before public competitive use.
- Three.js is loaded from jsDelivr CDN, so clients need internet access.
