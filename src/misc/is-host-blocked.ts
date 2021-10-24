import { fetchMeta } from '@/misc/fetch-meta';

export async function isHostBlocked(host: string): Promise<boolean> {
	const meta = await fetchMeta();

	if (meta.allowlistMode) {
		return !meta.allowedHosts.includes(host);
	} else {
		return meta.blockedHosts.includes(host);
	}
}
