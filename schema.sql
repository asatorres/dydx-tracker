-- Users table
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Users wallets table
CREATE TABLE IF NOT EXISTS `users_wallets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `address` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `users_wallets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tokens table
CREATE TABLE IF NOT EXISTS `tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `symbol` varchar(50) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `symbol` (`symbol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Trades table
CREATE TABLE IF NOT EXISTS `trades_dex` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user` int NOT NULL,
  `trade_id` varchar(255) NOT NULL,
  `trader_address` varchar(255) NOT NULL,
  `token` varchar(50) NOT NULL,
  `bias` tinyint(1) NOT NULL COMMENT '1=long, 0=short',
  `size` varchar(50) NOT NULL,
  `sum_open` varchar(50) NOT NULL,
  `sum_close` varchar(50) DEFAULT NULL,
  `limit_price` varchar(50) NOT NULL,
  `exit_price` varchar(50) DEFAULT NULL,
  `start_date` datetime NOT NULL,
  `end_date` datetime DEFAULT NULL,
  `funding` varchar(50) DEFAULT '0',
  `realised_pnl` varchar(50) DEFAULT '0',
  `pnl` varchar(50) DEFAULT '0',
  `is_profitable` tinyint(1) DEFAULT '0',
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `trade_id` (`trade_id`),
  KEY `user` (`user`),
  KEY `token` (`token`),
  CONSTRAINT `trades_dex_ibfk_1` FOREIGN KEY (`user`) REFERENCES `users` (`id`),
  CONSTRAINT `trades_dex_ibfk_2` FOREIGN KEY (`token`) REFERENCES `tokens` (`symbol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;