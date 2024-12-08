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

const createQueueForChat = async (pk) => {
  const chatQueue = `${queue}_${pk}`;
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
  logger.info(`Message sent to queue ${chatQueue}`);
  return { chatId, message };
};

const receiveMessagesFromUserQueue = async (socket, userPk) => {
  const userQueue = await createQueueForChat(userPk);
  logger.info(`Listening for messages on queue ${userQueue}`);

  let chatMessages = [];

  await channel.consume(
    userQueue,
    (msg) => {
      if (msg !== null) {
        try {
          const { chatId, senderPk, message } = JSON.parse(
            msg.content.toString()
          );
          chatMessages.push({ chatId, senderPk, message });
          logger.info(
            `Received message from ${senderPk} in chat ${chatId}, message: ${message}, userPk: ${userPk}`
          );

          channel.ack(msg);
        } catch (error) {
          logger.error("Error processing message:", error);
          channel.nack(msg, false, false);
        }
      }
    },
    { noAck: false }
  );

  return chatMessages;
};

module.exports = {
  connectRabbitMQ,
  sendMessageToUserQueue,
  receiveMessagesFromUserQueue,
};
