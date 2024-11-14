const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const logger = require("./utils/winstonLogger");
const morgan = require("morgan");
const streamMiddleware = require("./utils/stream");
const config = require("config");
const http = require("http");
const bodyParser = require("body-parser");
const setupSocket = require("./lib/socket");

const app = express();
const server = http.createServer(app);

app.use(bodyParser.json());

app.use(express.static("public"));

//CORS Policy
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  next();
});

//healthcheck
app.use(helmet());
app.use(compression());

app.use(morgan("combined", { streamMiddleware }));

// app.get("/", (req, res) => {
//   res.status(200).send(`App service running`);
// });

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

server.listen(config.get("server.port"), () => {
  logger.info("Server is running on :" + config.get("server.port"));
});

app.use((error, req, res, next) => {
  const cleanedMessage = error.message.replace(/\\x1b\[\d+m/g, "");

  logger.error(cleanedMessage);
  const status = error.statusCode;
  const message = error.message.toString().trim();
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

setupSocket(server);

module.exports = app;
