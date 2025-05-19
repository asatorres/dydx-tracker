import RabbitMQClient from "../config/messaging";

/**
 * Sends a message to the specified RabbitMQ queue. This function abstracts
 * away the details of connecting to RabbitMQ and publishing a message, providing
 * a simple interface for message sending throughout the application.
 *
 * @param queueName The name of the queue to which the message will be sent. This
 *                  allows for dynamic targeting of different queues based on the
 *                  caller's needs.
 * @param messageContent The content of the message to be sent. This content is
 *                       expected to be a string, which can be structured as JSON
 *                       or any other format as required by the application logic.
 * @returns None. However, it logs the outcome of the message publishing attempt,
 *          indicating success or failure in the console.
 */
export async function sendMessage(
  queueName: string,
  messageContent: string,
  expiration: string | any = null
) {
  // Get the single instance of the RabbitMQ client and ensure it is connected.
  const rabbitMQClient = RabbitMQClient.getInstance();
  await rabbitMQClient.connect();

  // Attempt to publish the message to the specified queue.
  const success = await rabbitMQClient.publishMessage(
    queueName,
    messageContent,
    expiration
  );

  // Log the outcome of the publishing attempt.
  if (success) {
    console.log(`Message published to ${queueName}`);
  } else {
    console.log(`Failed to publish message to ${queueName}`);
  }
}
