ALTER TABLE `staffAccounts` ADD `ownerSlot` int;--> statement-breakpoint
ALTER TABLE `staffAccounts` ADD CONSTRAINT `staffAccounts_ownerSlot_unique` UNIQUE(`ownerSlot`);