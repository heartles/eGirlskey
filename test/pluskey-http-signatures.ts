process.env.NODE_ENV = 'test';

import rndstr from 'rndstr';
import * as assert from 'assert';
import { initTestDb } from './utils';
import { generateKeyPairSync, createSign } from 'crypto';
import { getConnection } from 'typeorm';
import { Meta } from '@/models/entities/meta';
import { fetchMeta } from '@/misc/fetch-meta';

const keyDesc = {
	modulusLength: 2048,
	publicKeyEncoding: {
		type: 'spki',
		format: 'pem',
	},
	privateKeyEncoding: {
		type: 'pkcs1',
		format: 'pem',
	},
};

describe('+HTTP Signatures', () => {
	before(async () => {
		await initTestDb(true);
	});

	describe('Valid Signatures', () => {
		const host = 'host1.test';
		const preferredUsername = `${rndstr('A-Z', 4)}${rndstr('a-z', 4)}`;
		const actorId = `https://${host}/users/${preferredUsername.toLowerCase()}`;
		const keyId = `${actorId}#main-key`;

		const { publicKey, privateKey } = generateKeyPairSync('rsa', keyDesc);

		const actor = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: actorId,
			type: 'Person',
			preferredUsername,
			inbox: `${actorId}/inbox`,
			outbox: `${actorId}/outbox`,
			publicKey: {
				id: keyId,
				owner: actorId,
				publicKeyPem: publicKey,
			},
		};

		it('accept valid rsa-sha256', async () => {
			const { MockResolver } = await import('./misc/mock-resolver');
			const { authorizeUserFromSignature } = await import('../src/misc/verify-signature');

			const resolver = new MockResolver();
			resolver._register(actorId, actor);
			resolver._register(keyId, actor);

			const signingString = '/notes/abcd1234 host2.test 2021-09-25 00:21 PST';
			const sign = createSign('SHA256');
			sign.write(signingString);
			sign.end();

			const signature = {
				scheme: 'Signature',
				signingString,
				algorithm: 'rsa-sha256',
				keyId: keyId,
				params: {
					keyId: keyId,
					algorithm: 'rsa-sha256',
					headers: ['(request-target)', 'host', 'date'],
					signature: sign.sign(privateKey, 'base64'),
				},
			};

			const verified = await authorizeUserFromSignature(signature, { resolver });

			assert.deepStrictEqual(verified?.user.uri, actorId);
		});
	});

	it('rejects invalid signature', async () => {
		const host = 'host1.test';
		const preferredUsername = `${rndstr('A-Z', 4)}${rndstr('a-z', 4)}`;
		const actorId = `https://${host}/users/${preferredUsername.toLowerCase()}`;
		const keyId = `${actorId}#main-key`;

		const { publicKey, privateKey } = generateKeyPairSync('rsa', keyDesc);

		const actor = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: actorId,
			type: 'Person',
			preferredUsername,
			inbox: `${actorId}/inbox`,
			outbox: `${actorId}/outbox`,
			publicKey: {
				id: keyId,
				owner: actorId,
				publicKeyPem: publicKey,
			},
		};
		const { MockResolver } = await import('./misc/mock-resolver');
		const { authorizeUserFromSignature } = await import('../src/misc/verify-signature');

		const resolver = new MockResolver();
		resolver._register(actorId, actor);
		resolver._register(keyId, actor);

		const signingString = '/notes/abcd1234 host2.test 2021-09-25 00:21 PST';
		const signature = {
			scheme: 'Signature',
			signingString,
			algorithm: 'rsa-sha256',
			keyId: keyId,
			params: {
				keyId: keyId,
				algorithm: 'rsa-sha256',
				headers: ['(request-target)', 'host', 'date'],
				signature: 'definitely not the right signature',
			},
		};

		const verified = await authorizeUserFromSignature(signature, { resolver });

		assert.deepStrictEqual(verified, null);
	});

	it('reject blocked host', async () => {
		const host = 'blocked.test';
		const preferredUsername = `${rndstr('A-Z', 4)}${rndstr('a-z', 4)}`;
		const actorId = `https://${host}/users/${preferredUsername.toLowerCase()}`;
		const keyId = `${actorId}#main-key`;

		const { publicKey, privateKey } = generateKeyPairSync('rsa', keyDesc);

		const actor = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: actorId,
			type: 'Person',
			preferredUsername,
			inbox: `${actorId}/inbox`,
			outbox: `${actorId}/outbox`,
			publicKey: {
				id: keyId,
				owner: actorId,
				publicKeyPem: publicKey,
			},
		};
		const { MockResolver } = await import('./misc/mock-resolver');
		const { authorizeUserFromSignature } = await import('../src/misc/verify-signature');

		const resolver = new MockResolver();
		resolver._register(actorId, actor);
		resolver._register(keyId, actor);

		// set the list of blocked hosts
		await getConnection().transaction(async transactionalEntityManager => {
			const meta = await transactionalEntityManager.findOne(Meta, {
				order: {
					id: 'DESC'
				}
			});

			if (meta) {
				await transactionalEntityManager.update(Meta, meta.id, {
					blockedHosts: [host],
				});
			} else {
				await transactionalEntityManager.save(Meta, {
					id: 'x',
					blockedHosts: [host],
				});
			}
		});

		// clear meta cache
		await fetchMeta(true);

		const signingString = '/notes/abcd1234 host2.test 2021-09-25 00:21 PST';
		const sign = createSign('SHA256');
		sign.write(signingString);
		sign.end();

		const signature = {
			scheme: 'Signature',
			signingString,
			algorithm: 'rsa-sha256',
			keyId: keyId,
			params: {
				keyId: keyId,
				algorithm: 'rsa-sha256',
				headers: ['(request-target)', 'host', 'date'],
				signature: sign.sign(privateKey, 'base64'),
			},
		};

		const verified = await authorizeUserFromSignature(signature, { resolver });

		assert.deepStrictEqual(verified, null);
	});
});
