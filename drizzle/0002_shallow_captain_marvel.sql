CREATE TABLE `inventoryVariants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`unitPriceCents` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryVariants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saleItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`itemId` int NOT NULL,
	`variantId` int NOT NULL,
	`quantity` int NOT NULL,
	`unitPriceCents` int NOT NULL,
	`totalCents` int NOT NULL,
	CONSTRAINT `saleItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`totalCents` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `inventoryMovements` ADD `variantId` int;