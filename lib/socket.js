const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const {
  connectRabbitMQ,
  receiveMessagesFromUserQueue,
  sendMessageToUserQueue,
} = require("./messageQueue");
const logger = require("../utils/winstonLogger");

const setupSocket = async (server) => {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const users = {};

  await connectRabbitMQ()
    .then(() => {
      logger.info(
        "RabbitMQ connection established. Setting up message listener."
      );
    })
    .catch((error) => {
      logger.error("Failed to set up RabbitMQ:", error);
    });

  io.on("connection", (socket) => {
    logger.info("User connected:", socket.id);

    /**
     * @param joinerPk : Public key of the joining user
     * @param chats : Array of chat IDs
     * @returns bring messages from the queue
     * @returns send online status to the other users
     */
    socket.on("join app", async (joinerPk, chats) => {
      logger.info(`User ${joinerPk} joined the app`);
      //TODO: Bring messages from the queue
      // await receiveMessagesFromUserQueue(io, pubkey);
      chats.forEach((chat) => {
        if (!users[chat]) {
          users[chat] = [];
        }
        if (users[chat].find((user) => user.pubkey === joinerPk)) {
          logger.info(`User ${joinerPk} is already in chat: ${chat}`);
          return;
        }
        users[chat].push({ socketId: socket.id, pubkey: joinerPk });
        socket.join(chat);
      });
      // Send online status to the other users
      let onlineUsers = [];
      chats.forEach((chat) => {
        socket.to(chat).emit("user online", joinerPk);
        const temp = users[chat].map((user) => user.pubkey);

        if (temp) {
          onlineUsers = onlineUsers.concat(temp);
        }
      });
      socket.emit("online users", onlineUsers);
    });

    /**
     * @param createrPk : Public key of the user who creates the chat
     * @param chat_id : Chat ID
     * @returns emit online status to the other users
     * @returns send online status to the user
     */
    socket.on("create chat", (createrPk, chat_id) => {
      logger.info(`User ${createrPk} created chat: ${chat_id}`);
      if (!users[chat_id]) {
        users[chat_id] = [];
      }
      if (users[chat_id].find((user) => user.pubkey === createrPk)) {
        logger.info(`User ${createrPk} is already in chat: ${chat_id}`);

        return;
      }

      users[chat_id].push({
        socketId: socket.id,
        pubkey: createrPk,
      });
      socket.join(chat_id);
      const onlineUsers = users[chat_id].map((user) => user.pubkey);
      socket.to(chat_id).emit("user online", createrPk);
      socket.emit("online users", onlineUsers);
    });

    /**
     * @param joinerPk : Public key of the joining user
     * @param chat_id : Chat ID
     * @returns emit online status to the other users
     * @returns send online status to the user
     * @returns check if the chat is full
     */
    socket.on("join chat", async (joinerPk, chat_id) => {
      logger.info(`User ${joinerPk} joined chat: ${chat_id}`);
      if (!users[chat_id]) {
        users[chat_id] = [];
      }
      if (users[chat_id].find((user) => user.pubkey === joinerPk)) {
        logger.info(`User ${joinerPk} is already in chat: ${chat_id}`);
        return;
      }
      if (users[chat_id].length >= 2) {
        socket.emit("join error", "Chat is full. Only two users are allowed.");
        return;
      }
      users[chat_id].push({ socketId: socket.id, pubkey: joinerPk });
      socket.join(chat_id);
      const onlineUsers = users[chat_id].map((user) => user.pubkey);
      socket.to(chat_id).emit("user online", joinerPk);
      socket.emit("online users", onlineUsers);
    });

    /**
     * @param senderPk : Public key of the sender
     * @param receiverPk : Public key of the receiver
     * @param message : Message to be sent
     * @param chatId : Chat ID
     * @returns check receiver's online status
     * @returns if the receiver is online, send the message
     * @returns if the receiver is offline, send the message to the queue
     */
    socket.on(
      "send message",
      async ({ senderPk, receiverPk, message, chatId }) => {
        let user_online = false;
        for (const chat in users) {
          if (users[chat].find((user) => user.pubkey === receiverPk)) {
            user_online = true;
            break;
          }
        }
        if (user_online) {
          socket.to(chatId).emit("receive message", {
            message,
            senderPk,
            receiverPk,
            chatId,
          });
        } else {
          await sendMessageToUserQueue(chatId, senderPk, receiverPk, message);
        }
      }
    );

    /**
     * @returns emit user disconnected
     */
    socket.on("disconnect", () => {
      logger.info("User disconnected:", socket.id);
      for (const chatId in users) {
        const user = users[chatId].find((user) => user.socketId === socket.id);
        if (user) {
          users[chatId] = users[chatId].filter((u) => u.socketId !== socket.id);
          socket.to(chatId).emit("user offline", user.pubkey);
        }
      }
    });

    /**
     * @param chatId : Chat ID
     * @param typerPk : Public key of the user who is typing
     * @returns emit user typing
     */
    socket.on("typing", (chatId, pubkey) => {
      socket.to(chatId).emit("user typing", pubkey);
    });

    /**
     * @param chatId : Chat ID
     * @param stopperPk : Public key of the user who stopped typing
     * @returns emit user stopped typing
     */
    socket.on("stop typing", (chatId, stopperPk) => {
      socket.to(chatId).emit("user stopped typing", stopperPk);
    });

    /**
     * @param chatId : Chat ID
     * @param senderPk : Public key of the sender
     * @param signResult : Signature result
     * @returns emit receive sign result
     */
    socket.on("sign result", (chatId, senderPk, signResult) => {
      socket.to(chatId).emit("receive sign result", {
        chatId,
        senderPk,
        signResult,
      });
    });
  });

  return io;
};

module.exports = setupSocket;
