// messageQueue.js
const amqp = require("amqplib");
const config = require("config");
const logger = require("../utils/winstonLogger");

let channel, queue;

const connectRabbitMQ = async () => {
  try {
    console.log("Connecting to RabbitMQ");
    const connection = await amqp.connect(config.get("rabbit.url"));
    channel = await connection.createChannel();
    queue = config.get("rabbit.queue");
    logger.info("Connected to RabbitMQ");
  } catch (error) {
    logger.error("Error connecting to RabbitMQ:", error);
  }
};

const createQueueForChat = async (chat_id) => {
  const chatQueue = `${queue}_${chat_id}`;
  await channel.assertQueue(chatQueue, { durable: true });
  return chatQueue;
};

const sendMessageToUserQueue = async (
  chatId,
  senderPk,
  receiverPk,
  message
) => {
  if (!channel) {
    logger.error("Channel is not defined. Cannot send message.");
    return;
  }

  const chatQueue = await createQueueForChat(receiverPk);
  const msg = JSON.stringify({ chatId, senderPk, receiverPk, message });

  channel.sendToQueue(chatQueue, Buffer.from(msg), { persistent: true });
  logger.info(`Message sent to queue ${chatQueue}: ${msg}`);
  return { chatId, message };
};

const receiveMessagesFromUserQueue = async (io, userPk) => {
  const chatQueue = await createQueueForChat(userPk);
  let chatMessages = {};

  channel.consume(
    chatQueue,
    (msg) => {
      if (msg !== null) {
        const { chatId, message } = JSON.parse(msg.content.toString());

        if (!chatMessages[chatId]) {
          chatMessages[chatId] = [];
        }
        chatMessages[chatId].push(message);
        console.log(`Received message from queue ${chatQueue}: ${message}`);

        channel.ack(msg);
      }
    },
    { noAck: false }
  );
  setTimeout(() => {
    Object.keys(chatMessages).forEach((chatId) => {
      const messages = chatMessages[chatId];

      io.to(userPk).emit("receive chat", {
        chat_id: chatId,
        messages: messages,
      });

      logger.info(
        `Sent all messages to user ${userPk} from chat ${chatId}:`,
        messages
      );
    });

    chatMessages = {};
  }, 1000);
};

module.exports = {
  connectRabbitMQ,
  sendMessageToUserQueue,
  receiveMessagesFromUserQueue,
};
