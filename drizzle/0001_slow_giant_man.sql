CREATE TABLE `enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`schoolYear` varchar(9) NOT NULL,
	`className` varchar(80) NOT NULL,
	`shift` enum('morning','afternoon','fulltime') NOT NULL DEFAULT 'morning',
	`status` enum('active','pending','cancelled') NOT NULL DEFAULT 'active',
	`enrollmentDate` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`type` enum('absence','late','homework','book','uniform','behavior','other') NOT NULL,
	`note` text NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`resolved` int NOT NULL DEFAULT 0,
	CONSTRAINT `incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` enum('uniform','book','other') NOT NULL,
	`size` varchar(30),
	`quantity` int NOT NULL DEFAULT 0,
	`minQuantity` int NOT NULL DEFAULT 5,
	`unitPriceCents` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemId` int NOT NULL,
	`type` enum('entry','exit') NOT NULL,
	`quantity` int NOT NULL,
	`reason` varchar(240),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`birthDate` varchar(10),
	`grade` varchar(80) NOT NULL,
	`guardianName` varchar(160) NOT NULL,
	`guardianPhone` varchar(40),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `students_id` PRIMARY KEY(`id`)
);
