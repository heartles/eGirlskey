import * as os from 'os';
import * as si from 'systeminformation';
import define from '../define';
import config from '@/config/index';

export const meta = {
	requireCredential: config.secureMode,

	desc: {
	},

	tags: ['meta'],

	params: {
	},
};

export default define(meta, async () => {
	const memStats = await si.mem();
	const fsStats = await si.fsSize();

	return {
		machine: os.hostname(),
		cpu: {
			model: os.cpus()[0].model,
			cores: os.cpus().length
		},
		mem: {
			total: memStats.total
		},
		fs: {
			total: fsStats[0].size,
			used: fsStats[0].used,
		},
	};
});
