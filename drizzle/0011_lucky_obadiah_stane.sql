CREATE TABLE `schoolProfile` (
	`id` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`cnpj` varchar(14),
	`address` text,
	`phone` varchar(20),
	`email` varchar(320),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schoolProfile_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sales` ADD `enrollmentId` int;--> statement-breakpoint
ALTER TABLE `sales` ADD `studentName` varchar(160);--> statement-breakpoint
ALTER TABLE `sales` ADD `enrollmentNumber` varchar(24);--> statement-breakpoint
ALTER TABLE `sales` ADD `schoolYear` varchar(9);--> statement-breakpoint
ALTER TABLE `sales` ADD `className` varchar(80);--> statement-breakpoint
ALTER TABLE `sales` ADD `guardianName` varchar(160);--> statement-breakpoint
ALTER TABLE `sales` ADD `guardianCpf` varchar(11);--> statement-breakpoint
ALTER TABLE `sales` ADD `guardianEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `sales` ADD `guardianAddress` text;--> statement-breakpoint
ALTER TABLE `sales` ADD `guardianPhones` text;--> statement-breakpoint
ALTER TABLE `sales` ADD `sellerName` varchar(160);--> statement-breakpoint
ALTER TABLE `sales` ADD `sellerCnpj` varchar(14);--> statement-breakpoint
ALTER TABLE `sales` ADD `sellerAddress` text;--> statement-breakpoint
ALTER TABLE `sales` ADD `sellerPhone` varchar(20);--> statement-breakpoint
ALTER TABLE `sales` ADD `sellerEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `sales` ADD `sellerConfigured` int DEFAULT 0 NOT NULL;