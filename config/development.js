require("dotenv").config();

module.exports = {
  rabbit: {
    url: process.env.RABBIT_URL,
    queue: process.env.RABBIT_QUEUE,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  },
};
