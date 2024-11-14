const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const {
  connectRabbitMQ,
  receiveMessagesFromUserQueue,
  sendMessageToUserQueue,
} = require("./messageQueue");
const logger = require("../utils/winstonLogger");

const JWT_SECRET = process.env.JWT_SECRET;

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

    socket.on("join app", async (pubkey) => {
      await receiveMessagesFromUserQueue(io, pubkey);
      logger.info(`User ${pubkey} joined the app`);
    });

    socket.on("join chat", async (chatId, pubkey) => {
      // Kullanıcı sayısını kontrol et
      console.log(users);
      if (!users[chatId]) {
        users[chatId] = [];
      }
      if (users[chatId].find((user) => user.pubkey === pubkey)) {
        // Kullanıcı zaten bu sohbette
        logger.info(`User ${pubkey} is already in chat: ${chatId}`);
        return;
      }
      if (users[chatId].length >= 2) {
        // İki kullanıcıdan fazlası varsa, kullanıcıya hata mesajı gönder
        socket.emit("join error", "Chat is full. Only two users are allowed.");
        return;
      }

      users[chatId].push({ socketId: socket.id, pubkey });
      socket.join(chatId); // Kullanıcıyı belirli bir chat ID'sine katılmasını sağla
      logger.info(`User ${pubkey} joined chat: ${chatId}`);
      // Diğer kullanıcılara çevrimiçi bilgisi gönder
      socket.to(chatId).emit("user online", pubkey); // Diğer kullanıcılara online bilgisi gönder
      // Kendisine diğer çevrimiçi kullanıcıları bildir
      const onlineUsers = users[chatId].map((user) => user.pubkey);
      socket.emit("online users", onlineUsers);
    });

    socket.on("send message", async ({ chatId, message, receiverPk }) => {
      const onlineUsers = users[chatId] || [];

      if (onlineUsers.length > 1) {
        // Eğer çevrimiçi kullanıcı varsa doğrudan ilet
        socket.to(chatId).emit("receive message", {
          message,
          receiverPk,
        });
      } else {
        await sendMessageToUserQueue(chatId, receiverPk, message);
      }
    });

    socket.on("disconnect", () => {
      logger.info("User disconnected:", socket.id);

      for (const chatId in users) {
        // Ayrılan kullanıcının pubkey'ini bul
        const user = users[chatId].find((user) => user.socketId === socket.id);

        // Eğer kullanıcı bulunduysa, pubkey ile diğer kullanıcılara bildirim gönder
        if (user) {
          users[chatId] = users[chatId].filter((u) => u.socketId !== socket.id);
          socket.to(chatId).emit("user offline", user.pubkey);
        }
      }
    });

    socket.on("create chat", (senderPublicKey, receiverPublicKey) => {
      const timestamp = Date.now();
      const payload = {
        spk: senderPublicKey,
        rpk: receiverPublicKey,
        tms: timestamp,
      };

      // JWT oluşturma
      const chatID = jwt.sign(payload, JWT_SECRET);

      // Oluşturulan chat ID'yi istemciye gönder
      socket.emit("chat created", {
        chatId: chatID,
        senderPublicKey: senderPublicKey,
        receiverPubkey: receiverPublicKey,
      });
    });

    socket.on("typing", (chatId, pubkey) => {
      socket.to(chatId).emit("user typing", pubkey);
    });

    // Yazma durumu sona erdiğinde
    socket.on("stop typing", (chatId) => {
      socket.to(chatId).emit("user stopped typing");
    });
  });

  return io;
};

module.exports = setupSocket;
