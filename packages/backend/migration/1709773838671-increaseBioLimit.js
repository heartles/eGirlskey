
export class IncreaseBioLimit1709773838671 {
    name = "IncreaseBioLimit1709773838671";

    async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE user_profile ALTER COLUMN description TYPE text;`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE user_profile ALTER COLUMN description TYPE varchar(2048) USING left(description, 2048);`);
    }

}
