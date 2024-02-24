
export class allowlist1635065559969 {
	constructor() {
		this.name = 'allowlist1635065559969';
	}

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" ADD "allowedHosts" character varying(256) array NOT NULL DEFAULT '{}'::varchar[]`);
		await queryRunner.query(`ALTER TABLE "meta" ADD "allowlistMode" boolean NOT NULL DEFAULT false`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "allowedHosts"`);
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "allowlistMode"`);
	}

}
