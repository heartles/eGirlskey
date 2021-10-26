import { fetchMeta } from '@/misc/fetch-meta';
import config from '@/config/index';
import { toPuny } from '@/misc/convert-host';
import { URL } from 'url';

const thisHost = toPuny(new URL(config.url).hostname);

export async function isHostBlocked(host: string | null): Promise<boolean> {
	if (host == null || host === thisHost) return false;

	const meta = await fetchMeta();

	if (meta.allowlistMode) {
		return !meta.allowedHosts.includes(host);
	} else {
		return meta.blockedHosts.includes(host);
	}
}
