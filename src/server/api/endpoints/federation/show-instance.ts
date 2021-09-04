import $ from 'cafy';
import define from '../../define';
import { Instances } from '@/models/index';
import { toPuny } from '@/misc/convert-host';
import config from '@/config/index';

export const meta = {
	tags: ['federation'],

	requireCredential: config.privateClientApi,

	params: {
		host: {
			validator: $.str
		}
	},

	res: {
		type: 'object' as const,
		optional: false as const, nullable: false as const,
		ref: 'FederationInstance'
	}
};

export default define(meta, async (ps, me) => {
	const instance = await Instances
		.findOne({ host: toPuny(ps.host) });

	return instance;
});
