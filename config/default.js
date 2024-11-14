require("dotenv").config();

module.exports = {
  node_env: process.env.NODE_ENV,
  server: {
    port: process.env.PORT,
  },
  
};
