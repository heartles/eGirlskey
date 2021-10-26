import { URL } from 'url';
import * as httpSignature from 'http-signature';
import { isHostBlocked } from '@/misc/is-host-blocked';
import { toPuny, extractDbHost } from '@/misc/convert-host';
import { getApId } from '@/remote/activitypub/type';
import DbResolver from '@/remote/activitypub/db-resolver';
import { AuthUser } from '@/remote/activitypub/db-resolver';
import Resolver from '@/remote/activitypub/resolver';
import { resolvePerson } from '@/remote/activitypub/models/person';
import { LdSignature } from '@/remote/activitypub/misc/ld-signature';
import { User } from '@/models/entities/user';
import Logger from '@/services/logger';
import { IActivity, IObject } from '@/remote/activitypub/type';

const logger = new Logger('verify-signature');

async function getAuthUserFromActorId(actorId: string, resolver: Resolver, dbResolver: DbResolver): Promise<AuthUser | null> {
	let authUser;
	try {
		authUser = await dbResolver.getAuthUserFromApId(actorId);
	} catch (e: any) {
		if (e.statusCode === 404) {
			// Try resolving user through AP get
			await resolvePerson(actorId, resolver);

			authUser = await dbResolver.getAuthUserFromApId(actorId);
		} else if (e.statusCode >= 400 && e.statusCode < 500) {
			logger.warn(`ignored deleted actors on both ends ${actorId} - ${e.statusCode}`);
		}

		if (authUser == null) {
			logger.error(`error in actor ${actorId} - ${e.statusCode || e}`);
			return null;
		}
	}
	return authUser;
}

async function getAuthUserFromKeyId(keyId: string, resolver: Resolver, dbResolver: DbResolver): Promise<AuthUser | null> {
	// HTTP-Signature keyIdを元にDBから取得
	let authUser = await dbResolver.getAuthUserFromKeyId(keyId);

	// try to resolve key (and associated user) through AP get
	if (authUser == null) {
		logger.info(`attempting to resolve key through AP get`);
		try {
			const maybeKey = await resolver.resolve(keyId) as any;

			// requesting the key's id typically returns either the key
			// object itself or the user
			let userId = maybeKey.owner;
			if (userId == null) {
				userId = maybeKey.id;

				if (userId == null) {
					logger.warn(`failed to acquire user from key ${keyId}`);
					return null;
				}
			}

			await resolvePerson(userId, resolver);

			authUser = await dbResolver.getAuthUserFromKeyId(keyId);
		} catch (e) {
			logger.error(`failed to resolve remote user: ${JSON.stringify(e)}`);
		}
	}

	return authUser;
}

function getActorId(actor: IObject | string): string | undefined {
	if (typeof(actor) === 'string') {
		return actor as string;
	}

	return actor.id;
}

export type AuthOptions = {
	activity?: IActivity,
	resolver?: Resolver,
};

export async function authorizeUserFromSignature(signature: httpSignature.IParsedSignature, options?: AuthOptions): Promise<AuthUser | null> {
	const host = toPuny(new URL(signature.keyId).hostname);
	const dbResolver = new DbResolver();
	const activity = options?.activity;
	const resolver = options?.resolver || new Resolver();

	// Early host check
	if (await isHostBlocked(host)) {
		logger.warn(`blocked request based on signature hostname: ${host}`);
		return null;
	}

	const keyIdLower = signature.keyId.toLowerCase();
	if (keyIdLower.startsWith('acct:')) {
		logger.warn(`old keyId is no longer supported. ${keyIdLower}`);
		return null;
	}

	// HTTP-Signature keyIdを元にDBから取得
	let authUser = await getAuthUserFromKeyId(signature.keyId, resolver, dbResolver);
	if (authUser == null && activity != null) {
		const actorId = getActorId(activity!.actor);
		if (actorId) {
			authUser = await getAuthUserFromActorId(actorId, resolver, dbResolver);
		}
	}

	// publicKey がなくても終了
	if (authUser?.key == null) {
		logger.warn(`failed to resolve user publicKey`);
		return null;
	}

	// HTTP-Signatureの検証
	const httpSignatureValidated = httpSignature.verifySignature(signature, authUser!.key.keyPem);
	const activityMatches = (activity == null) || (authUser?.user?.uri === activity!.actor);

	// また、signatureのsignerは、activity.actorと一致する必要がある
	if (!httpSignatureValidated || !activityMatches) {
		// 一致しなくても、でもLD-Signatureがありそうならそっちも見る
		if (activity?.signature) {
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
			authUser = await getAuthUserFromKeyId(activity!.signature.creator, resolver, dbResolver);
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
			logger.warn(`http-signature verification failed and no LD-Signature. keyId=${signature.keyId}`);
			return null;
		}
	}

	// Final host check
	const userHost = authUser!.user.uri ? extractDbHost(authUser!.user.uri) : authUser!.user.host;
	if (await isHostBlocked(toPuny(userHost))) {
		logger.warn(`blocked request based on user host: ${userHost}`);
		return null;
	}

	// TODO: Also verify host isn't suspended
	return authUser;
}

