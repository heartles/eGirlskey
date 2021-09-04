import { URL } from 'url';
import * as httpSignature from 'http-signature';
import { fetchMeta } from '@/misc/fetch-meta';
import { toPuny, extractDbHost } from '@/misc/convert-host';
import { getApId } from '@/remote/activitypub/type';
import DbResolver from '@/remote/activitypub/db-resolver';
import Resolver from '@/remote/activitypub/resolver';
import { resolvePerson } from '@/remote/activitypub/models/person';
import { LdSignature } from '@/remote/activitypub/misc/ld-signature';
import Logger from '@/services/logger';

const logger = new Logger('verify-signature');

async function resolvePersonFromKeyId(id: string) {
	const resolver = new Resolver();

	const maybeKey = await resolver.resolve(id);
    
    logger.debug(JSON.stringify(maybeKey));

    // requesting the key's id typically returns either the key
    // object itself or the user
    let userId = maybeKey.owner;
    if (userId == null) {
        logger.debug('owner field not present, using id field');
        logger.debug(maybeKey.id);
        userId = maybeKey.id;
        
        if (userId == null) {
            throw 'failed to acquire user from key';
        }
    }

    return await resolvePerson(userId, resolver);
}

export async function verifySignature(signature, activity) {
	const host = toPuny(new URL(signature.keyId).hostname);
	logger.debug(JSON.stringify(signature));

	// ブロックしてたら中断
	const meta = await fetchMeta();
	if (meta.blockedHosts.includes(host)) {
		throw `Blocked request: ${host}`;
	}

	const keyIdLower = signature.keyId.toLowerCase();
	if (keyIdLower.startsWith('acct:')) {
		throw `Old keyId is no longer supported. ${keyIdLower}`;
	}

	// TDOO: キャッシュ
	const dbResolver = new DbResolver();

	// HTTP-Signature keyIdを元にDBから取得
	let authUser = await dbResolver.getAuthUserFromKeyId(signature.keyId);

	// keyIdでわからなければ、activity.actorを元にDBから取得 || activity.actorを元にリモートから取得
	if (authUser == null && activity != null) {
		try {
			authUser = await dbResolver.getAuthUserFromApId(getApId(activity.actor));
		} catch (e) {
			// 対象が4xxならスキップ
			if (e.statusCode >= 400 && e.statusCode < 500) {
				throw `skip: Ignored deleted actors on both ends ${activity.actor} - ${e.statusCode}`;
			}
			throw `Error in actor ${activity.actor} - ${e.statusCode || e}`;
		}
	}

	// それでもわからなければ終了
	if (authUser == null) {
		// try to resolve key (and associated user) through AP get
		try {
			authUser = await resolvePersonFromKeyId(signature.keyId);
		} catch (e) {
			logger.error(e);
			throw `skip: failed to resolve user`;
		}
	}

	// publicKey がなくても終了
	if (authUser.key == null) {
		throw `skip: failed to resolve user publicKey`;
	}

	// HTTP-Signatureの検証
	const httpSignatureValidated = httpSignature.verifySignature(signature, authUser.key.keyPem);
	const matchesActivity = (activity == null) || (authUser.user.uri === activity.actor);

	if (!httpSignatureValidated || !matchesActivity) {
		if (activity && activity.signature) {
			if (activity.signature.type !== 'RsaSignature2017') {
				throw `skip: unsupported LD-signature type ${activity.signature.type}`;
			}

			// activity.signature.creator: https://example.oom/users/user#main-key
			// みたいになっててUserを引っ張れば公開キーも入ることを期待する
			if (activity.signature.creator) {
				const candicate = activity.signature.creator.replace(/#.*/, '');
                await resolvePerson(candicate).catch(() => null);
			}

			// keyIdからLD-Signatureのユーザーを取得
			authUser = await dbResolver.getAuthUserFromKeyId(activity.signature.creator);
			if (authUser == null) {
				throw `skip: LD-Signatureのユーザーが取得できませんでした`;
			}

			if (authUser.key == null) {
				throw `skip: LD-SignatureのユーザーはpublicKeyを持っていませんでした`;
			}

			// LD-Signature検証
			const ldSignature = new LdSignature();
			const verified = await ldSignature.verifyRsaSignature2017(activity, authUser.key.keyPem).catch(() => false);
			if (!verified) {
				throw `skip: LD-Signatureの検証に失敗しました`;
			}

			// もう一度actorチェック
			if (authUser.user.uri !== activity.actor) {
				throw `skip: LD-Signature user(${authUser.user.uri}) !== activity.actor(${activity.actor})`;
			}

			// ブロックしてたら中断
			const ldHost = extractDbHost(authUser.user.uri);
			if (meta.blockedHosts.includes(ldHost)) {
				throw `Blocked request: ${ldHost}`;
			}
		} else {
			throw `skip: http-signature verification failed and no LD-Signature. keyId=${signature.keyId}`;
		}
	}

	// TODO: Verify host isn't suspended
	return authUser;
};

