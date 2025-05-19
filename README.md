# dYdX Tracker

A TypeScript application that monitors dYdX trading activity in real-time via WebSockets, processes trade data, and stores it in a MySQL database for analysis and notifications.

## Overview

This project connects to the dYdX WebSocket API to track trading positions for specified traders. It processes real-time updates, calculates trade metrics, and stores the data in a MySQL database. Optional notifications can be sent via RabbitMQ for integration with other systems.

### Features

- Real-time WebSocket connection to dYdX exchange
- Automatic reconnection handling with exponential backoff
- Position tracking and trade calculation
- MySQL database integration with transaction support and deadlock handling
- Configurable trader monitoring
- RabbitMQ integration for notifications (optional)
- Typescript for type safety and better developer experience

## Architecture

The application follows a modular architecture:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  dYdX WebSocket │────▶│  Data Processor │────▶│  MySQL Database │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │                 │
                        │    RabbitMQ     │
                        │  (Optional)     │
                        │                 │
                        └─────────────────┘
```

## How It Works

1. The application connects to the dYdX WebSocket API
2. It subscribes to position updates for specified traders
3. When position updates are received, it processes the data
4. Processed trades are stored in the MySQL database with transaction support
5. Optional notifications can be sent via RabbitMQ for integration with other systems

## Prerequisites

- Node.js (v14+)
- MySQL Server (v5.7+ or v8.0+)
- RabbitMQ Server (optional, for notifications)
- TypeScript (v4.0+)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/dydx-tracker.git
   cd dydx-tracker
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file based on the provided `.env.example`:

   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration details.

5. Set up the MySQL database:
   - Create a database with the name specified in your `.env` file
   - Import the schema using the provided SQL file:
     ```bash
     mysql -u your_username -p your_database_name < schema.sql
     ```

## Database Schema

The application uses the following database tables:

- `users` - Stores user information

  - `id`: Unique identifier
  - `username`: User's name
  - `created_at`: Timestamp of creation

- `users_wallets` - Maps users to their wallet addresses

  - `id`: Unique identifier
  - `user_id`: Reference to users table
  - `address`: Wallet address
  - `created_at`: Timestamp of creation

- `tokens` - Stores information about tracked tokens

  - `id`: Unique identifier
  - `symbol`: Token symbol (e.g., BTC, ETH)
  - `name`: Token name
  - `is_active`: Whether the token is actively tracked
  - `created_at`: Timestamp of creation

- `trades_dex` - Stores trade information
  - Contains details about trades including position size, prices, PnL, etc.

See the `schema.sql` file for the complete database schema.

## Usage

### Development Mode

```bash
npm run dev
```

This starts the application with nodemon for automatic reloading during development.

### Production Mode

```bash
npm run build
npm start
```

The build command compiles TypeScript to JavaScript, and the start command runs the compiled application.

## Configuration

The application is configured through environment variables in the `.env` file:

### dYdX WebSocket Configuration

- `DYDX_WEBSOCKET_URI` - dYdX WebSocket endpoint (default: wss://indexer.dydx.trade/v4/ws)
- `DYDX_SUBACCOUNTS_CHANNEL` - dYdX subaccounts channel name (default: v4_subaccounts)

### Database Configuration

- `SQL_HOST` - MySQL host address
- `SQL_USER` - MySQL username
- `SQL_PASSWORD` - MySQL password
- `SQL_DB_NAME` - MySQL database name
- `SQL_PORT` - MySQL port (default: 3306)

### Server Configuration

- `SERVER_GROUP` - Server group identifier for distributed setups

### RabbitMQ Configuration (optional)

- `RABBITMQ_URL` - RabbitMQ connection URL
- `RABBITMQ_CA_CERT` - CA certificate for secure RabbitMQ connections
- `RABBITMQ_CLIENT_CERT` - Client certificate for secure RabbitMQ connections
- `RABBITMQ_CLIENT_KEY` - Client key for secure RabbitMQ connections

## Customization

### Adding New Traders to Monitor

To add new traders to monitor, you need to:

1. Add the user to the `users` table
2. Add their wallet address to the `users_wallets` table

Example SQL:

```sql
-- Add a new user
INSERT INTO users (username) VALUES ('Trader Name');

-- Add their wallet address
INSERT INTO users_wallets (user_id, address)
VALUES (LAST_INSERT_ID(), '0x1234567890abcdef1234567890abcdef12345678');
```

### Extending Functionality

The modular architecture makes it easy to extend the application:

- Add new data processors in the `src/utils` directory
- Implement additional notification channels beyond RabbitMQ
- Create custom analytics by querying the stored trade data

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failures**

   - Check your internet connection
   - Verify the dYdX WebSocket URI in your `.env` file
   - Ensure the dYdX API is operational

2. **Database Connection Issues**

   - Verify your MySQL credentials in the `.env` file
   - Check that the MySQL server is running
   - Ensure the database exists and has the correct schema

3. **RabbitMQ Connection Problems**
   - Verify your RabbitMQ credentials and URL
   - Check that the RabbitMQ server is running
   - Ensure certificates are correctly formatted if using SSL

## Project Structure

```
dydx-tracker/
├── src/                  # Source code
│   ├── config/           # Configuration files
│   ├── constants/        # Constants and interfaces
│   ├── services/         # Core services
│   ├── utils/            # Utility functions
│   └── index.ts          # Application entry point
├── schema.sql            # Database schema
├── .env.example          # Example environment variables
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
└── README.md             # Project documentation
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
