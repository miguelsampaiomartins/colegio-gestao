CREATE TABLE `inventoryCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryCategories_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryCategories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `staffRoles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`permissions` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staffRoles_id` PRIMARY KEY(`id`),
	CONSTRAINT `staffRoles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `inventoryItems` MODIFY COLUMN `category` varchar(80) NOT NULL;--> statement-breakpoint
ALTER TABLE `staffAccounts` ADD `roleId` int;