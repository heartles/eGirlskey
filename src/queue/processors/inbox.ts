import { URL } from 'url';
import * as Bull from 'bull';
import * as httpSignature from 'http-signature';
import perform from '../../remote/activitypub/perform';
import Logger from '../../services/logger';
import { registerOrFetchInstanceDoc } from '../../services/register-or-fetch-instance-doc';
import { Instances } from '../../models';
import { instanceChart } from '../../services/chart';
import { fetchMeta } from '@/misc/fetch-meta';
import { toPuny, extractDbHost } from '@/misc/convert-host';
import { getApId } from '../../remote/activitypub/type';
import { fetchInstanceMetadata } from '../../services/fetch-instance-metadata';
import { InboxJobData } from '../types';
import DbResolver from '../../remote/activitypub/db-resolver';
import { resolvePerson } from '../../remote/activitypub/models/person';
import { LdSignature } from '../../remote/activitypub/misc/ld-signature';
import verifySignature from '../../misc/verify-signature';

const logger = new Logger('inbox');

// ユーザーのinboxにアクティビティが届いた時の処理
export default async (job: Bull.Job<InboxJobData>): Promise<string> => {
	const signature = job.data.signature;	// HTTP-signature
	const activity = job.data.activity;

	//#region Log
	const info = Object.assign({}, activity) as any;
	delete info['@context'];
	logger.debug(JSON.stringify(info, null, 2));
	//#endregion

    let authUser;
    try {
        authUser = verifySignature(signature, activity);
    } catch (ex) {
        return ex;
    }

	// activity.idがあればホストが署名者のホストであることを確認する
	if (typeof activity.id === 'string') {
		const signerHost = extractDbHost(authUser.user.uri!);
		const activityIdHost = extractDbHost(activity.id);
		if (signerHost !== activityIdHost) {
			return `skip: signerHost(${signerHost}) !== activity.id host(${activityIdHost}`;
		}
	}

	// Update stats
	registerOrFetchInstanceDoc(authUser.user.host).then(i => {
		Instances.update(i.id, {
			latestRequestReceivedAt: new Date(),
			lastCommunicatedAt: new Date(),
			isNotResponding: false
		});

		fetchInstanceMetadata(i);

		instanceChart.requestReceived(i.host);
	});

	// アクティビティを処理
	await perform(authUser.user, activity);
	return `ok`;
};
