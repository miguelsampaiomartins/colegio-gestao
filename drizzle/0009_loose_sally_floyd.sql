CREATE TABLE `studentPhones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`number` varchar(20) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `studentPhones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `students` ADD `cpf` varchar(11);--> statement-breakpoint
ALTER TABLE `students` ADD `guardianCpf` varchar(11);--> statement-breakpoint
ALTER TABLE `students` ADD `address` text;--> statement-breakpoint
ALTER TABLE `students` ADD `guardianEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_cpf_unique` UNIQUE(`cpf`);