CREATE TABLE `staffAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(64) NOT NULL,
	`fullName` varchar(160) NOT NULL,
	`jobTitle` varchar(120) NOT NULL,
	`role` enum('owner','staff') NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`sessionVersion` int NOT NULL DEFAULT 1,
	`failedAttempts` int NOT NULL DEFAULT 0,
	`lockedUntil` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staffAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `staffAccounts_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `staffAccounts_username_unique` UNIQUE(`username`)
);
