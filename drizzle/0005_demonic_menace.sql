ALTER TABLE `sales` ADD `status` enum('completed','cancelled') DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `cancelledAt` timestamp;