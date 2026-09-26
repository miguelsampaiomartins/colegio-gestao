CREATE TABLE `auditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`actorName` varchar(160) NOT NULL,
	`actorRole` enum('owner','staff') NOT NULL,
	`action` varchar(64) NOT NULL,
	`targetType` varchar(64),
	`targetId` int,
	`summary` varchar(240) NOT NULL,
	`occurredAt` bigint NOT NULL,
	CONSTRAINT `auditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backupRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`status` enum('success','failure') NOT NULL,
	`filename` varchar(255),
	`bytes` bigint,
	`message` varchar(240),
	`startedAt` bigint NOT NULL,
	`finishedAt` bigint NOT NULL,
	CONSTRAINT `backupRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `audit_actor_time_idx` ON `auditEvents` (`actorUserId`,`occurredAt`);