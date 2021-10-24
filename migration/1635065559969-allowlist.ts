import {MigrationInterface, QueryRunner} from "typeorm";

export class allowlist1635065559969 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meta" ADD "allowedHosts" character varying(256) array NOT NULL DEFAULT '{}'::varchar[]`);
        await queryRunner.query(`ALTER TABLE "meta" ADD "allowlistMode" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "allowedHosts"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "allowlistMode"`);
    }

}
