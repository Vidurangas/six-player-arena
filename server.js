const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

const rooms = new Map();
const MAX_PLAYERS = 6;
const COLORS = [0x42d9ff, 0xff5d73, 0xffd34e, 0x8cff6b, 0xb58aff, 0xff9d45];

function makeRoom() {
  let code;
  do { code = crypto.randomBytes(3).toString("hex").toUpperCase(); }
  while (rooms.has(code));
  const room = { code, host: null, status: "lobby", players: new Map(), winner: null };
  rooms.set(code, room);
  return room;
}
function publicRoom(room) {
  return {
    code: room.code, status: room.status, winner: room.winner,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, color: p.color, alive: p.alive,
      kills: p.kills, x: p.x, z: p.z, rot: p.rot
    }))
  };
}
function sendRoom(room) { io.to(room.code).emit("roomState", publicRoom(room)); }
function findPlayer(socket) {
  for (const room of rooms.values()) {
    const p = room.players.get(socket.id);
    if (p) return { room, player: p };
  }
  return null;
}
function finishIfNeeded(room) {
  if (room.status !== "playing") return;
  const alive = [...room.players.values()].filter(p => p.alive);
  if (alive.length <= 1) {
    room.status = "finished";
    room.winner = alive[0]?.name || "No winner";
    sendRoom(room);
    io.to(room.code).emit("matchOver", { winner: room.winner });
  }
}
io.on("connection", socket => {
  socket.on("createRoom", ({ name }) => {
    const room = makeRoom();
    joinRoom(socket, room, name);
    room.host = socket.id;
    socket.emit("roomCreated", { code: room.code });
  });
  socket.on("joinRoom", ({ code, name }) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room) return socket.emit("joinError", "Room not found. Check the code or ask for a new link.");
    joinRoom(socket, room, name);
  });
  function joinRoom(socket, room, rawName) {
    if (room.status !== "lobby") return socket.emit("joinError", "This match has already started.");
    if (room.players.size >= MAX_PLAYERS) return socket.emit("joinError", "This room is full (6/6).");
    const name = String(rawName || "Player").trim().slice(0, 16) || "Player";
    const p = {
      id: socket.id, name, color: COLORS[room.players.size], alive: true,
      kills: 0, x: (Math.random() - .5) * 18, z: (Math.random() - .5) * 18,
      rot: 0, lastShot: 0, hp: 100
    };
    room.players.set(socket.id, p);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    sendRoom(room);
  }
  socket.on("startMatch", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.host !== socket.id) return;
    if (room.players.size < 2) return socket.emit("joinError", "At least 2 players are required.");
    room.status = "playing"; room.winner = null;
    for (const p of room.players.values()) {
      p.alive = true; p.hp = 100; p.kills = 0;
      p.x = (Math.random() - .5) * 18; p.z = (Math.random() - .5) * 18;
    }
    sendRoom(room);
    io.to(room.code).emit("matchStarted");
  });
  socket.on("move", data => {
    const found = findPlayer(socket);
    if (!found || found.room.status !== "playing" || !found.player.alive) return;
    const p = found.player;
    p.x = Math.max(-24, Math.min(24, Number(data.x) || 0));
    p.z = Math.max(-24, Math.min(24, Number(data.z) || 0));
    p.rot = Number(data.rot) || 0;
    socket.to(found.room.code).emit("playerMoved", { id: p.id, x: p.x, z: p.z, rot: p.rot });
  });
  socket.on("shoot", data => {
    const found = findPlayer(socket);
    if (!found || found.room.status !== "playing" || !found.player.alive) return;
    const { room, player: shooter } = found;
    const now = Date.now();
    if (now - shooter.lastShot < 280) return;
    shooter.lastShot = now;
    const dx = Number(data.dx), dz = Number(data.dz);
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return;
    const mag = Math.hypot(dx, dz) || 1;
    const ux = dx / mag, uz = dz / mag;
    let hit = null, best = 32;
    for (const target of room.players.values()) {
      if (target.id === shooter.id || !target.alive) continue;
      const rx = target.x - shooter.x, rz = target.z - shooter.z;
      const along = rx * ux + rz * uz;
      const side = Math.abs(rx * uz - rz * ux);
      if (along > 0 && along < best && side < 1.05) { best = along; hit = target; }
    }
    io.to(room.code).emit("shotEffect", { id: shooter.id, x: shooter.x, z: shooter.z, dx: ux, dz: uz });
    if (hit) {
      hit.alive = false; shooter.kills++;
      io.to(room.code).emit("eliminated", { victim: hit.id, killer: shooter.id, victimName: hit.name, killerName: shooter.name });
      sendRoom(room);
      finishIfNeeded(room);
    }
  });
  socket.on("disconnect", () => {
    const found = findPlayer(socket);
    if (!found) return;
    const { room, player } = found;
    room.players.delete(socket.id);
    if (room.host === socket.id) room.host = room.players.keys().next().value || null;
    if (room.players.size === 0) rooms.delete(room.code);
    else { sendRoom(room); finishIfNeeded(room); }
  });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Arena server listening on ${PORT}`));