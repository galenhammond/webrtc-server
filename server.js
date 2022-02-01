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

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
