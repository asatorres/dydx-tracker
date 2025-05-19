import amqp, { Channel, Connection, ConsumeMessage, Options } from "amqplib";
import dotenv from "dotenv";
dotenv.config();

/**
 * The RabbitMQClient class manages RabbitMQ connections and operations,
 * including publishing messages to a queue and consuming messages from it.
 */
class RabbitMQClient {
  private static instance: RabbitMQClient | null = null;
  private url: string;
  private sslOptions: Options.Connect | null = null;
  private connection: Connection | null = null;
  private channel: Channel | null = null;

  /**
   * Initializes the RabbitMQ client. The RabbitMQ URL is read from environment variables,
   * defaulting to "amqp://localhost" if not specified. This allows for easy configuration
   * and deployment.
   */
  private constructor() {
    this.url = process.env.RABBIT_MQ_URL || "amqp://localhost";

    const caCert = process.env.RABBITMQ_CA_CERT;
    const clientCert = process.env.RABBITMQ_CLIENT_CERT;
    const clientKey = process.env.RABBITMQ_CLIENT_KEY;

    if (caCert && clientCert && clientKey) {
      this.sslOptions = {
        protocol: "amqps",
        ca: [Buffer.from(caCert, "utf-8")],
        cert: Buffer.from(clientCert, "utf-8"),
        key: Buffer.from(clientKey, "utf-8"),
      } as Options.Connect;
    }
  }

  /**
   * Gets the single instance of the RabbitMQClient class.
   */
  public static getInstance(): RabbitMQClient {
    if (!RabbitMQClient.instance) {
      RabbitMQClient.instance = new RabbitMQClient();
    }
    return RabbitMQClient.instance;
  }

  /**
   * Establishes a connection to RabbitMQ and initializes a channel for operations.
   * This method ensures that only one connection and channel are created even if called
   * multiple times, following the singleton pattern for the connection and channel.
   */
  public async connect(): Promise<void> {
    // Check if a channel already exists to avoid creating multiple connections
    if (this.channel) return;

    try {
      // Establish a connection to the RabbitMQ server
      this.connection = await amqp.connect(this.url, this.sslOptions);
      // Create a channel on the established connection
      this.channel = await this.connection.createChannel();
      console.log("Connected to RabbitMQ");
    } catch (error) {
      // Log any connection errors and rethrow them
      console.error("Failed to connect to RabbitMQ:", error);
      throw error;
    }
  }

  /**
   * Publishes a message to a specified queue. This method takes the name of the queue
   * and the content of the message as parameters, allowing messages to be sent to
   * different queues dynamically.
   *
   * @param queueName The name of the queue to which the message will be published.
   * @param messageContent The content of the message to be published.
   * @param expiration The expiration time for the message.
   * @returns A promise that resolves to a boolean indicating whether the message was
   *          successfully queued.
   */
  public async publishMessage(
    queueName: string,
    messageContent: string,
    expiration?: string
  ): Promise<boolean> {
    if (!this.channel) {
      throw new Error("Channel not initialized. Call connect() first.");
    }

    try {
      await this.channel.assertQueue(queueName, { durable: true });
      return this.channel.sendToQueue(queueName, Buffer.from(messageContent), {
        persistent: true,
        ...(expiration && { expiration }),
      });
    } catch (error) {
      console.error("Failed to publish message:", error);
      return false;
    }
  }
}

export default RabbitMQClient;
