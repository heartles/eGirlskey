import { URL } from 'url';
import * as httpSignature from 'http-signature';
import { fetchMeta } from '@/misc/fetch-meta';
import { toPuny, extractDbHost } from '@/misc/convert-host';
import { getApId } from '@/remote/activitypub/type';
import DbResolver from '@/remote/activitypub/db-resolver';
import { AuthUser } from '@/remote/activitypub/db-resolver';
import Resolver from '@/remote/activitypub/resolver';
import { resolvePerson, updatePerson } from '@/remote/activitypub/models/person';
import { LdSignature } from '@/remote/activitypub/misc/ld-signature';
import { User } from '@/models/entities/user';
import Logger from '@/services/logger';
import { IActivity } from '@/remote/activitypub/type';

const logger = new Logger('verify-signature');

async function resolvePersonFromKeyId(id: string, dbResolver: DbResolver): Promise<AuthUser?> {
	const resolver = new Resolver();

	const maybeKey = await resolver.resolve(id) as any;

	// requesting the key's id typically returns either the key
	// object itself or the user
	let userId = maybeKey.owner;
	if (userId == null) {
		userId = maybeKey.id;

		if (userId == null) {
			logger.warn(`failed to acquire user from key ${id}`);
			return null;
		}
	}

	await resolvePerson(userId, resolver);
	await updatePerson(userId);
	return await dbResolver.getAuthUserFromApId(userId);
}

async function getAuthUserFromKeyId(keyId: string, actor?: any): Promise<AuthUser?> {
	// TDOO: キャッシュ
	const dbResolver = new DbResolver();

	// HTTP-Signature keyIdを元にDBから取得
	let authUser = await dbResolver.getAuthUserFromKeyId(keyId);

	// If actor provided, try to get authUser from that
	if (authUser == null && actor != null) {
		try {
			authUser = await dbResolver.getAuthUserFromApId(getApId(actor));
		} catch (e) {
			// 対象が4xxならスキップ
			if (e.statusCode >= 400 && e.statusCode < 500) {
				logger.warn(`ignored deleted actors on both ends ${actor} - ${e.statusCode}`);
			}
			logger.error(`error in actor ${actor} - ${e.statusCode || e}`);
		}
	}

	// try to resolve key (and associated user) through AP get
	if (authUser == null) {
		logger.info(`attempting to resolve key through AP get`);
		try {
			authUser = await resolvePersonFromKeyId(keyId, dbResolver);
		} catch (e) {
			logger.error(`failed to resolve remote user: ${e}`);
		}
	}

	return authUser;
}

function tryVerifyWithUser(authUser: AuthUser, signature: httpSignature.IParsedSignature, activity?: IActivity | null): boolean {
	logger.debug(`using actor ${JSON.stringify(authUser)}`);

	if (!authUser || !authUser.key || !authUser.key.keyPem) {
		logger.debug(`key not present`);
		return false;
	}

	const httpSignatureValidated = httpSignature.verifySignature(signature, authUser.key.keyPem);
	const activityMatches = (activity == null) || (authUser && authUser.user && authUser.user.uri === activity.actor);
	if (!httpSignatureValidated) logger.debug(`signature verification failed`);
	if (!activityMatches) logger.debug(`activity did not match`);
	return httpSignatureValidated && activityMatches;
}

export async function verifySignature(signature: httpSignature.IParsedSignature, activity?: IActivity | null): Promise<AuthUser?> {
	const host = toPuny(new URL(signature.keyId).hostname);

	// ブロックしてたら中断
	const meta = await fetchMeta();
	if (meta.blockedHosts.includes(host)) {
		logger.warn(`blocked request based on signature hostname: ${host}`)
		return null;
	}

	const keyIdLower = signature.keyId.toLowerCase();
	if (keyIdLower.startsWith('acct:')) {
		logger.warn(`old keyId is no longer supported. ${keyIdLower}`);
		return null;
	}

	// HTTP-Signature keyIdを元にDBから取得
	let authUser = await getAuthUserFromKeyId(signature.keyId, activity ? activity.actor : null);

	// publicKey がなくても終了
	if (authUser.key == null) {
		logger.warn(`failed to resolve user publicKey`);
		return null;
	}

	// また、signatureのsignerは、activity.actorと一致する必要がある
	if (!tryVerifyWithUser(authUser, signature, activity)) {
		// 一致しなくても、でもLD-Signatureがありそうならそっちも見る
		if (activity && activity.signature) {
			if (activity.signature.type !== 'RsaSignature2017') {
				logger.warn(`unsupported LD-signature type ${activity.signature.type}`);
				return null;
			}

			// activity.signature.creator: https://example.oom/users/user#main-key
			// みたいになっててUserを引っ張れば公開キーも入ることを期待する
			if (activity.signature.creator) {
				const candicate = activity.signature.creator.replace(/#.*/, '');
				await resolvePerson(candicate).catch(() => null);
			}

			// keyIdからLD-Signatureのユーザーを取得
			authUser = await getAuthUserFromKeyId(activity.signature.creator);
			if (authUser == null) {
				logger.warn(`LD-Signatureのユーザーが取得できませんでした`);
				return null;
			}

			if (authUser.key == null) {
				logger.warn(`LD-SignatureのユーザーはpublicKeyを持っていませんでした`);
				return null;
			}

			// LD-Signature検証
			const ldSignature = new LdSignature();
			const verified = await ldSignature.verifyRsaSignature2017(activity, authUser.key.keyPem).catch(() => false);
			if (!verified) {
				logger.warn(`LD-Signatureの検証に失敗しました`);
				return null;
			}

			// もう一度actorチェック
			if (authUser.user.uri !== activity.actor) {
				logger.warn(`LD-Signature user(${authUser.user.uri}) !== activity.actor(${activity.actor})`);
				return null;
			}
		} else {
			logger.info(`signature validation failed for actor ${signature.keyId}, attempting to update from remote`);
			authUser = await resolvePersonFromKeyId(signature.keyId, new DbResolver());

			if (authUser == null) {
				logger.warn(`error refreshing actor ${signature.keyId}`);
				return null;
			}
			
			if (!tryVerifyWithUser(authUser, signature, activity)) {
				logger.warn(`http-signature verification failed and no LD-Signature. keyId=${signature.keyId}`);
				return null;
			}

			logger.info(`signature validation for ${signature.keyId} succeeded after refresh`);
		}
	}

	const userHost = authUser.user.uri ? extractDbHost(authUser.user.uri) : authUser.user.host;
	if (meta.blockedHosts.includes(userHost)) {
		logger.warn(`blocked request based on user host: ${signature.keyId}`);
		return null;
	}

	// TODO: Also verify host isn't suspended
	return authUser;
};

