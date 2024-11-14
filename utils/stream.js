const logger = require("./winstonLogger");

const stream = {
  write: (message) => {
    // Use the winston logger to log the message
    logger.http(message.trim());
  },
};

module.exports = stream;
