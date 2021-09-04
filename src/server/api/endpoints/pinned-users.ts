import define from '../define';
import { Users } from '@/models/index';
import { fetchMeta } from '@/misc/fetch-meta';
import { parseAcct } from '@/misc/acct';
import { User } from '@/models/entities/user';
import config from '@/config/index';

export const meta = {
	tags: ['users'],

	requireCredential: config.privateClientApi,

	params: {
	},

	res: {
		type: 'array' as const,
		optional: false as const, nullable: false as const,
		items: {
			type: 'object' as const,
			optional: false as const, nullable: false as const,
			ref: 'User',
		}
	},
};

export default define(meta, async (ps, me) => {
	const meta = await fetchMeta();

	const users = await Promise.all(meta.pinnedUsers.map(acct => Users.findOne(parseAcct(acct))));

	return await Users.packMany(users.filter(x => x !== undefined) as User[], me, { detail: true });
});
