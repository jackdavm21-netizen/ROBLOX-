const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let calls = [];
let units = [];

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send current state to new client
  socket.emit("state:init", { calls, units });

  // New unit logs in
  socket.on("unit:login", (unit) => {
    const existing = units.find((u) => u.id === socket.id);
    if (!existing) {
      const newUnit = {
        id: socket.id,
        callsign: unit.callsign,
        role: unit.role,
        status: "Available",
      };
      units.push(newUnit);
      io.emit("units:update", units);
    }
  });

  // Unit status change
  socket.on("unit:status", (status) => {
    units = units.map((u) =>
      u.id === socket.id ? { ...u, status } : u
    );
    io.emit("units:update", units);
  });

  // New call
  socket.on("call:new", (call) => {
    const newCall = {
      id: Date.now().toString(),
      priority: call.priority,
      type: call.type,
      location: call.location,
      unitsAssigned: call.unitsAssigned || "",
      details: call.details || "",
      status: "Open",
    };
    calls.unshift(newCall);
    io.emit("calls:update", calls);
  });

  // Change call status
  socket.on("call:cycleStatus", (callId) => {
    calls = calls.map((c) => {
      if (c.id !== callId) return c;
      let next = "Open";
      if (c.status === "Open") next = "Active";
      else if (c.status === "Active") next = "Closed";
      else if (c.status === "Closed") next = "Open";
      return { ...c, status: next };
    });
    io.emit("calls:update", calls);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    units = units.filter((u) => u.id !== socket.id);
    io.emit("units:update", units);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("CAD server running on port", PORT);
});
