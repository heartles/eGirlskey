export class AutoDeleteNotes1709530777533 {
    name = "AutoDeleteNotes1709530777533";

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE user_profile ADD "autoDeleteNotes" boolean NOT NULL DEFAULT false;`);
		await queryRunner.query(`ALTER TABLE user_profile ADD "autoDeleteNotesMinutes" integer NOT NULL DEFAULT 43200;`);
    }

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE user_profile DROP COLUMN "autoDeleteNotes";`);
		await queryRunner.query(`ALTER TABLE user_profile DROP COLUMN "autoDeleteNotesMinutes";`);
	}

}
