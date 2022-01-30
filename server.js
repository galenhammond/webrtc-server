require("dotenv").config();
require("console-stamp")(console, "HH:MM:ss.l");
const { assert } = require("console");
const express = require("express");
const fs = require("fs");
const app = express();

const { createServer } = require("https");
const { Server } = require("socket.io");
const prompts = require("./utils/prompts");

const options = {
  //key: fs.readFileSync("./certificates/example.com+5-key.pem"),
  //cert: fs.readFileSync("./certificates/example.com+5.pem"),
  requestCert: false,
  rejectUnauthorized: false,
};

const server = createServer(options, app);

const io = new Server(server, {
  transports: ["websocket", "polling"],
  allowEIO3: true,
  cors: false,
});
const PORT = process.env.PORT || 3001;

var queue = [];
var rooms = {};

function getNewPrompt() {
  return prompts[Math.floor(Math.random() * prompts.length)];
}

app.get("/", (req, res) => {
  res.send("Connected");
});

io.on("connection", (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on("webrtc-request", (data) => {
    console.log(`WebRTC communication request received from ${socket.id}`);
    const meetingId = data.meetingId;
    if (rooms.hasOwnProperty(meetingId)) {
      if (socket.queued) {
        return;
      }

      rooms[meetingId].forEach((otherUser) => {
        if (!otherUser) return;
        assert(otherUser.id !== socket.id);
        if (otherUser.queued) {
          otherUser.queued = false;
        }
        console.log(
          `${socket.id} and ${otherUser.id} session created at room ${meetingId}`
        );
        socket.to(otherUser.id).emit("webrtc-request", { to: socket.id });
      });

      socket.meetingId = meetingId;
      socket.join(meetingId);
      rooms[meetingId] = [...rooms[meetingId], socket];
      io.to(meetingId).emit("update-user-list", {
        users: rooms[meetingId].map((user) => user.id),
      });
    } else {
      if (!socket.queued) {
        rooms[meetingId] = [socket];
        socket.queued = true;
        socket.meetingId = meetingId;
        socket.join(meetingId);
        console.log(`${socket.id} pushed to meeting room ${meetingId} queue`);
        console.log(
          `Users waiting in room ${meetingId} queue: ${rooms[meetingId].length}`
        );
      }
    }
  });

  socket.on("send-message", (data) => {
    if (!data.message | data.sender) return;

    socket.to(socket.room).emit("receive-message", data);
  });

  socket.on("call-user", (data) => {
    console.log(
      `Received SDP offer from ${socket.id}. Forwarding to ${data.to}`
    );
    socket
      .to(data.to)
      .emit("call-made", { offer: data.offer, socket: socket.id });
  });

  socket.on("make-answer", (data) => {
    socket.to(data.to).emit("answer-made", {
      socket: socket.id,
      answer: data.answer,
    });
    console.log(
      `Received SDP answer from ${socket.id}. Forwarding to ${data.to}`
    );
  });

  socket.on("new-ice-candidate", (data) => {
    socket.to(data.to).emit("new-ice-candidate", {
      to: socket.id,
      candidate: data.candidate,
    });
    console.log(
      `Forwarding ice canadiate from ${socket.id} sent to ${data.to}`
    );
  });

  socket.on("request-prompt", () => {
    console.log(`Prompt request received from ${socket.id}`);
    if (socket.meetingId) {
      meetingId = socket.meetingId;

      socket.ready = true;
      //if (rooms[socket.meetingId].length < 2) return;
      rooms[socket.meetingId].forEach((user) => {
        if (!user.ready) return;
      });

      const prompt = getNewPrompt();
      console.log(prompt);
      io.to(socket.meetingId).emit("new-prompt", {
        prompt: prompt,
      });
      console.log(`Prompt sent to room ${socket.meetingId}`);
    }
  });

  socket.on("disconnect", () => {
    if (socket.meetingId) {
      meetingId = socket.meetingId;
      rooms[meetingId] = rooms[meetingId].filter(
        (item) => item.id !== socket.id
      );
      if (!rooms[meetingId].length) {
        console.log(`Meeting ${meetingId} has ended`);
        delete rooms[meetingId];
      }
    }
    console.log(`${socket.id} disconnected`);
  });

  socket.on("connect_error", (err) => {
    console.error(`connect_error due to ${err.message}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
