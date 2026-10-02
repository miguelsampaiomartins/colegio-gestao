CREATE TABLE `guardianAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`fullName` varchar(160) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`sessionVersion` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `guardianAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `guardianAccounts_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `guardianMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guardianId` int NOT NULL,
	`studentId` int,
	`direction` enum('fromGuardian','fromSchool') NOT NULL,
	`subject` varchar(160) NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	CONSTRAINT `guardianMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `guardianNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guardianId` int NOT NULL,
	`studentId` int,
	`kind` enum('incident','message','announcement') NOT NULL,
	`title` varchar(160) NOT NULL,
	`body` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `guardianNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `guardianStudents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guardianId` int NOT NULL,
	`studentId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `guardianStudents_id` PRIMARY KEY(`id`)
);
