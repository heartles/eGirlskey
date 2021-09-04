import $ from 'cafy';
import define from '../../define';
import { convertLog } from '@/services/chart/core';
import { activeUsersChart } from '@/services/chart/index';
import config from '@/config/index';

export const meta = {
	tags: ['charts', 'users'],

	requireCredential: config.secureMode,

	params: {
		span: {
			validator: $.str.or(['day', 'hour']),
		},

		limit: {
			validator: $.optional.num.range(1, 500),
			default: 30,
		},

		offset: {
			validator: $.optional.nullable.num,
			default: null,
		},
	},

	res: convertLog(activeUsersChart.schema),
};

export default define(meta, async (ps) => {
	return await activeUsersChart.getChart(ps.span as any, ps.limit!, ps.offset ? new Date(ps.offset) : null);
});
