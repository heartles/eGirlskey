/**
 * Languages Loader
 */

const fs = require('fs');
const yaml = require('js-yaml');

const merge = (...args) => args.reduce((a, c) => ({
	...a,
	...c,
	...Object.entries(a)
		.filter(([k]) => c && typeof c[k] === 'object')
		.reduce((a, [k, v]) => (a[k] = merge(v, c[k]), a), {})
}), {});

const languages = [
	'ar-SA',
	'cs-CZ',
	'da-DK',
	'de-DE',
	'en-US',
	'en-US-stock',
	'es-ES',
	'fr-FR',
	'id-ID',
	'ja-JP',
	'ja-KS',
	'kab-KAB',
	'kn-IN',
	'ko-KR',
	'nl-NL',
	'no-NO',
	'pl-PL',
	'pt-PT',
	'ru-RU',
	'ug-CN',
	'uk-UA',
	'zh-CN',
	'zh-TW',
];

const primaries = {
	'en': 'US',
	'ja': 'JP',
	'zh': 'CN',
};

const pluskeyLanguages = [
	'en-US',
	'en-US-stock',
];

const locales = languages.reduce((a, c) => (a[c] = yaml.load(fs.readFileSync(`${__dirname}/${c}.yml`, 'utf-8')) || {}, a), {});
const pluskeyLocales = pluskeyLanguages.reduce((a, c) => (a[c] = { pluskey: yaml.load(fs.readFileSync(`${__dirname}/pluskey/${c}.yml`, 'utf-8')) || {} }, a), {});

module.exports = Object.entries(locales)
	.map(([k, v]) => [k, merge(
		pluskeyLocales['en-US-stock'],
		pluskeyLocales[k],
		v,
	)])
	.reduce((a, [k ,v]) => (a[k] = (() => {
		const [lang] = k.split('-');
		switch (k) {
			case 'ja-JP': return v;
			case 'ja-KS':
			case 'en-US': return merge(
				locales['ja-JP'],
				locales['en-US-stock'],
				v,
			);
			default: return merge(
				locales['ja-JP'],
				locales['en-US-stock'],
				locales[`${lang}-${primaries[lang]}`] || {},
				v
			);
		}
	})(), a), {});

